from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Booking, ContactMessage, DemoRequest, Location, Notification, Profile, Salon, Service


class RegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            'email':'New.Customer@example.test',
            'password':'A9!xP7qLm2#v',
            'full_name':'New Customer',
            'phone':'1234567890',
        }

    def test_registration_creates_profile_role_and_usable_session(self):
        response = self.client.post('/api/auth/register/', self.payload, format='json')

        self.assertEqual(response.status_code, 201, response.json())
        user = User.objects.get(email='new.customer@example.test')
        self.assertEqual(user.profile.full_name, 'New Customer')
        self.assertEqual(user.profile.phone, '1234567890')
        self.assertEqual(user.profile.role, 'customer')
        self.assertEqual(list(user.roles.values_list('role', flat=True)), ['customer'])
        self.assertTrue(response.json()['access'])
        self.assertTrue(response.json()['refresh'])

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['email'], 'new.customer@example.test')
        self.assertEqual(me.json()['full_name'], 'New Customer')

    def test_cors_allows_the_frontend_dev_server_port(self):
        response = self.client.options(
            '/api/auth/register/',
            HTTP_ORIGIN='http://127.0.0.1:8080',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers['Access-Control-Allow-Origin'],
            'http://127.0.0.1:8080',
        )

    def test_registration_rejects_duplicate_email_without_creating_another_user(self):
        self.client.post('/api/auth/register/', self.payload, format='json')
        self.payload['email'] = self.payload['email'].upper()

        response = self.client.post('/api/auth/register/', self.payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.filter(email='new.customer@example.test').count(), 1)

    def test_registration_rejects_passwords_that_do_not_meet_backend_policy(self):
        self.payload['password'] = 'short'

        response = self.client.post('/api/auth/register/', self.payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())


class DemoRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        state = Location.objects.create(name='Odisha', level='state')
        Location.objects.create(name='Khordha', level='district', parent=state)
        self.payload = {
            'salonName':'Demo Salon',
            'salonType':'Unisex Salon',
            'ownerName':'Demo Owner',
            'phone':'1234567890',
            'email':'demo.owner@example.test',
            'address':'1 Main Street',
            'state':'Odisha',
            'district':'Khordha',
            'pinCode':'751001',
            'openingTime':'09:00',
            'closingTime':'21:00',
            'password':'V7!qL2#pN9@x',
        }

    def test_demo_submission_creates_owner_salon_and_login_session(self):
        response = self.client.post('/api/demo/submit/', self.payload, format='json')

        self.assertEqual(response.status_code, 201, response.json())
        user = User.objects.get(email='demo.owner@example.test')
        self.assertEqual(user.profile.role, 'salon_owner')
        self.assertEqual(list(user.roles.values_list('role', flat=True)), ['salon_owner'])
        self.assertEqual(user.salons.count(), 1)
        self.assertEqual(DemoRequest.objects.count(), 1)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['id'], user.id)
        self.assertEqual(me.json()['role'], 'salon_owner')

    def test_demo_submission_rejects_passwords_that_fail_account_policy(self):
        self.payload['password'] = 'password'

        response = self.client.post('/api/demo/submit/', self.payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Salon.objects.count(), 0)


class QueryFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Location.objects.create(name='Enabled State', level='state', is_active=True)
        Location.objects.create(name='Disabled State', level='state', is_active=False)

    def test_boolean_query_filters_accept_frontend_lowercase_values(self):
        response = self.client.get(
            '/api/db/locations/?select=name&level=state&is_active=true'
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual([row['name'] for row in response.json()], ['Enabled State'])

    def test_invalid_boolean_query_returns_client_error_instead_of_server_error(self):
        response = self.client.get(
            '/api/db/locations/?level=state&is_active=enabled'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('is_active', response.json())


class ApiResourceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.customer = User.objects.create_user(
            username='customer@example.test',
            email='customer@example.test',
            password='ValidPass123!',
        )
        cls.other_customer = User.objects.create_user(
            username='other@example.test',
            email='other@example.test',
            password='ValidPass123!',
        )
        Profile.objects.create(id=cls.customer, full_name='Customer')
        Profile.objects.create(id=cls.other_customer, full_name='Other')
        cls.salon = Salon.objects.create(
            name='Alpha Salon',
            slug='alpha-salon',
            status='approved',
            is_active=True,
            phone='1234567890',
            email='alpha@example.test',
        )
        cls.other_salon = Salon.objects.create(
            name='Beta Salon',
            slug='beta-salon',
            status='approved',
            is_active=True,
        )
        cls.service = Service.objects.create(
            salon=cls.salon,
            name='Alpha Cut',
            price=10,
            duration_minutes=30,
        )
        Service.objects.create(
            salon=cls.other_salon,
            name='Beta Cut',
            price=20,
            duration_minutes=45,
        )
        cls.booking = Booking.objects.create(
            salon=cls.salon,
            customer=cls.customer,
            service=cls.service,
            date='2026-10-01',
            start_time='10:00',
            end_time='10:30',
            duration_minutes=30,
        )
        Booking.objects.create(
            salon=cls.other_salon,
            customer=cls.other_customer,
            date='2026-10-02',
            start_time='11:00',
            end_time='11:30',
            duration_minutes=30,
        )
        Notification.objects.create(user=cls.customer, title='Customer notice')
        Notification.objects.create(user=cls.other_customer, title='Other notice')

    def setUp(self):
        self.client = APIClient()

    def test_health_reports_configured_database(self):
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['database'], 'sqlite3')

    def test_unconfigured_password_reset_is_reported_as_unavailable(self):
        response = self.client.post(
            '/api/auth/password-reset/',
            {'email':'customer@example.test'},
            format='json',
        )
        self.assertEqual(response.status_code, 501)
        self.assertIn('not configured', response.json()['error'])

    def test_public_salon_response_excludes_contact_details(self):
        response = self.client.get('/api/db/salons/?select=id,name,phone,email')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]['name'], 'Alpha Salon')
        self.assertNotIn('phone', response.json()[0])
        self.assertNotIn('email', response.json()[0])

    def test_authenticated_salon_read_serializes_and_filters(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get(f'/api/db/salons/?id={self.salon.id}&select=id,name,pin_code')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]['name'], 'Alpha Salon')

    def test_foreign_key_filters_are_applied(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get(
            f'/api/db/services/?salon_id={self.salon.id}&select=id,name,salon_id'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['name'] for row in response.json()], ['Alpha Cut'])

    def test_nested_service_fields_match_frontend_contract(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get(
            f'/api/db/bookings/?id={self.booking.id}&select=id,services(name,duration_min)'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]['services'], {'name': 'Alpha Cut', 'duration_min': 30})

    def test_nested_customer_profile_alias_matches_frontend_contract(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get(
            f'/api/db/bookings/?id={self.booking.id}'
            '&select=id,profiles:customer_id(full_name,phone,email)'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()[0]['profiles'],
            {'full_name':'Customer','phone':'','email':'customer@example.test'},
        )

    def test_user_scoped_data_cannot_be_read_from_another_user(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get('/api/db/notifications/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['title'] for row in response.json()], ['Customer notice'])

    def test_bookings_are_scoped_and_booking_serializer_works(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get(
            f'/api/db/bookings/?customer_id={self.customer.id}'
            '&select=id,booking_date,slot_time,duration_min,salon_id,service_id'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]['id'], str(self.booking.id))
        self.assertEqual(response.json()[0]['booking_date'], '2026-10-01')
        self.assertEqual(response.json()[0]['service_id'], str(self.service.id))

    def test_offset_and_total_count_follow_client_query_contract(self):
        response = self.client.get(
            '/api/db/services/?select=id,name&order=name&offset=1&limit=1&count=exact'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 2)
        self.assertEqual([row['name'] for row in response.json()['data']], ['Beta Cut'])

    def test_head_count_has_no_rows(self):
        response = self.client.get('/api/db/services/?head=1&count=exact')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['data'])
        self.assertEqual(response.json()['count'], 2)

    def test_foreign_user_cannot_update_another_users_notification(self):
        self.client.force_authenticate(self.customer)
        other_notification = Notification.objects.get(title='Other notice')
        response = self.client.patch(
            f'/api/db/notifications/?id={other_notification.id}',
            {'is_read': True},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_public_contact_submission_allows_optional_email(self):
        response = self.client.post(
            '/api/db/contact_messages/',
            {'name':'Visitor','email':None,'phone':'1234567890','subject':'Help','message':'Please contact me.'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(ContactMessage.objects.get().email)

    def test_profile_upsert_updates_existing_current_user(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            '/api/db/profiles/?on_conflict=id',
            {'id':self.customer.id,'full_name':'Updated name','phone':'5551234567'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Profile.objects.filter(pk=self.customer.id).count(), 1)
        self.assertEqual(Profile.objects.get(pk=self.customer.id).full_name, 'Updated name')

    def test_customer_can_cancel_but_not_change_booking_status_to_completed(self):
        self.client.force_authenticate(self.customer)
        response = self.client.patch(
            f'/api/db/bookings/?id={self.booking.id}',
            {'status':'completed'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)
        response = self.client.patch(
            f'/api/db/bookings/?id={self.booking.id}',
            {'status':'cancelled','cancellation_reason':'Customer cancelled'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

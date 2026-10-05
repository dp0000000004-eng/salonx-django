from datetime import timedelta
from io import BytesIO
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Booking,
    ContactMessage,
    DemoRequest,
    Location,
    Notification,
    Profile,
    Salon,
    SalonSubscription,
    Service,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatusHistory,
)


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


class StaffAdminAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='legacy-admin',
            email='legacy-admin@example.test',
            password='StrongAdminPass123!',
        )

    def test_staff_superuser_without_profile_can_log_in_and_access_admin_gate(self):
        login = self.client.post(
            '/api/auth/login/',
            {'email':self.admin.email,'password':'StrongAdminPass123!'},
            format='json',
        )

        self.assertEqual(login.status_code, 200, login.json())
        self.assertEqual(login.json()['user']['role'], 'super_admin')
        self.assertEqual(login.json()['user']['full_name'], '')

        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + login.json()['access'])
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['role'], 'super_admin')

        has_role = self.client.post(
            '/api/rpc/has_role/',
            {'_role':'super_admin'},
            format='json',
        )
        self.assertEqual(has_role.status_code, 200)
        self.assertIs(has_role.json(), True)

    def test_admin_status_is_public_and_counts_staff_superusers(self):
        response = self.client.get('/api/admin/status/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'super_admin_count':1})

    def test_admin_status_returns_zero_when_no_super_admin_exists(self):
        self.admin.delete()

        response = self.client.get('/api/admin/status/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'super_admin_count':0})


class LoginThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='throttle-admin',
            email='throttle-admin@example.test',
            password='StrongAdminPass123!',
        )

    def tearDown(self):
        cache.clear()

    def test_anonymous_public_api_traffic_does_not_exhaust_login_limit(self):
        public_responses = [
            self.client.get('/api/admin/status/', REMOTE_ADDR='198.51.100.24')
            for _ in range(61)
        ]
        login = self.client.post(
            '/api/auth/login/',
            {'email':self.admin.email,'password':'StrongAdminPass123!'},
            format='json',
            REMOTE_ADDR='198.51.100.24',
        )

        self.assertTrue(all(response.status_code == 200 for response in public_responses[:60]))
        self.assertEqual(public_responses[-1].status_code, 429)
        self.assertEqual(login.status_code, 200, login.json())

    def test_login_remains_rate_limited_on_its_own_scope(self):
        payload = {'email':self.admin.email,'password':'StrongAdminPass123!'}
        responses = [
            self.client.post(
                '/api/auth/login/',
                payload,
                format='json',
                REMOTE_ADDR='198.51.100.25',
            )
            for _ in range(11)
        ]

        self.assertTrue(all(response.status_code == 200 for response in responses[:10]))
        self.assertEqual(responses[-1].status_code, 429)


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
            'city':'Bhubaneswar',
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
        self.assertEqual(user.salons.get().city, 'Bhubaneswar')
        self.assertEqual(DemoRequest.objects.count(), 1)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['id'], user.id)
        self.assertEqual(me.json()['role'], 'salon_owner')

        owned_salons = self.client.get('/api/db/salons/', {'owner_id':user.id})
        self.assertEqual(owned_salons.status_code, 200, owned_salons.json())
        self.assertEqual(len(owned_salons.json()), 1)
        self.assertEqual(owned_salons.json()[0]['status'], 'pending')
        self.assertFalse(owned_salons.json()[0]['is_active'])

    def test_demo_submission_rejects_passwords_that_fail_account_policy(self):
        self.payload['password'] = 'password'

        response = self.client.post('/api/demo/submit/', self.payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Salon.objects.count(), 0)


class SubscriptionManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='subscription-admin',
            email='subscription-admin@example.test',
            password='StrongAdminPass123!',
        )
        owner = User.objects.create_user(
            username='subscription-owner',
            email='subscription-owner@example.test',
            password='StrongOwnerPass123!',
        )
        self.salon = Salon.objects.create(
            owner=owner,
            name='Subscription Salon',
            slug='subscription-salon',
            status='approved',
            is_active=True,
        )
        self.plan = SubscriptionPlan.objects.create(
            code='all_in_one',
            name='All in One',
            price=100,
        )
        self.client.force_authenticate(self.admin)

    def manage(self, action, **extra):
        return self.client.post(
            '/api/rpc/admin_manage_subscription/',
            {'_salon_id':str(self.salon.id),'_action':action,**extra},
            format='json',
        )

    def test_activate_creates_subscription_and_updates_legacy_record(self):
        response = self.manage('activate', _days=30)

        self.assertEqual(response.status_code, 200, response.json())
        subscription = SalonSubscription.objects.get(salon=self.salon)
        legacy = Subscription.objects.get(salon=self.salon)
        self.assertEqual(subscription.status, 'active')
        self.assertEqual(legacy.status, 'active')
        self.assertEqual(legacy.plan, self.plan)
        self.assertGreater(subscription.expires_at, timezone.now() + timedelta(days=29))
        self.assertEqual(SubscriptionStatusHistory.objects.get(salon=self.salon).status, 'active')

    def test_extend_preserves_active_status_and_adds_days_after_current_expiry(self):
        expires_at = timezone.now() + timedelta(days=3)
        subscription = SalonSubscription.objects.create(
            salon=self.salon,
            owner=self.salon.owner,
            plan=self.plan,
            status='active',
            started_at=timezone.now() - timedelta(days=27),
            expires_at=expires_at,
        )

        response = self.manage('extend', _days=7)

        self.assertEqual(response.status_code, 200, response.json())
        subscription.refresh_from_db()
        self.assertEqual(subscription.status, 'active')
        self.assertEqual(subscription.started_at, expires_at)
        self.assertEqual(subscription.expires_at, expires_at + timedelta(days=7))

    def test_extend_trial_sets_trial_dates_and_trialing_status(self):
        response = self.manage('extend_trial', _days=14, _note='Approved trial')

        self.assertEqual(response.status_code, 200, response.json())
        subscription = SalonSubscription.objects.get(salon=self.salon)
        self.assertEqual(subscription.status, 'trialing')
        self.assertIsNotNone(subscription.trial_start_date)
        self.assertEqual(subscription.trial_end_date, subscription.expires_at)
        self.assertEqual(SubscriptionStatusHistory.objects.get(salon=self.salon).note, 'Approved trial')
        self.assertEqual(Subscription.objects.get(salon=self.salon).status, 'trialing')

    def test_invalid_action_or_duration_does_not_create_subscription(self):
        invalid_action = self.manage('unknown')
        invalid_days = self.manage('activate', _days=0)
        fractional_days = self.manage('activate', _days=1.5)
        excessive_days = self.manage('activate', _days=3651)

        self.assertEqual(invalid_action.status_code, 400)
        self.assertEqual(invalid_days.status_code, 400)
        self.assertEqual(fractional_days.status_code, 400)
        self.assertEqual(excessive_days.status_code, 400)
        self.assertFalse(SalonSubscription.objects.filter(salon=self.salon).exists())

    def test_non_admin_cannot_change_subscription(self):
        owner = self.salon.owner
        self.client.force_authenticate(owner)

        response = self.manage('activate')

        self.assertEqual(response.status_code, 403)
        self.assertFalse(SalonSubscription.objects.filter(salon=self.salon).exists())

    def test_salon_approval_starts_configured_trial_and_creates_subscription_record(self):
        salon = Salon.objects.create(
            owner=self.salon.owner,
            name='Pending Trial Salon',
            slug='pending-trial-salon',
            status='pending',
            is_active=False,
        )
        before = timezone.now()
        response = self.client.post(
            '/api/rpc/admin_set_salon_status/',
            {'_salon_id':str(salon.id),'_status':'approved'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.json())
        salon.refresh_from_db()
        subscription = SalonSubscription.objects.get(salon=salon)
        self.assertEqual(salon.status, 'approved')
        self.assertTrue(salon.is_active)
        self.assertEqual(subscription.status, 'trialing')
        self.assertEqual(subscription.plan, self.plan)
        self.assertEqual(subscription.trial_start_date, subscription.started_at)
        self.assertEqual(subscription.trial_end_date, subscription.expires_at)
        self.assertGreater(subscription.expires_at, before + timedelta(days=13))
        self.assertEqual(Subscription.objects.get(salon=salon).status, 'trialing')
        self.assertEqual(SubscriptionStatusHistory.objects.filter(salon=salon).count(), 1)

    def test_reapproving_salon_does_not_reset_existing_subscription(self):
        salon = Salon.objects.create(
            owner=self.salon.owner,
            name='Reapproved Salon',
            slug='reapproved-salon',
            status='pending',
            is_active=False,
        )
        url = '/api/rpc/admin_set_salon_status/'
        payload = {'_salon_id':str(salon.id),'_status':'approved'}
        first = self.client.post(url, payload, format='json')
        self.assertEqual(first.status_code, 200, first.json())
        subscription = SalonSubscription.objects.get(salon=salon)
        original_expiry = subscription.expires_at

        second = self.client.post(url, payload, format='json')

        self.assertEqual(second.status_code, 200, second.json())
        subscription.refresh_from_db()
        self.assertEqual(subscription.expires_at, original_expiry)
        self.assertEqual(SubscriptionStatusHistory.objects.filter(salon=salon).count(), 1)

    def test_approval_preserves_existing_legacy_paid_subscription(self):
        salon = Salon.objects.create(
            owner=self.salon.owner,
            name='Legacy Active Salon',
            slug='legacy-active-salon',
            status='pending',
            is_active=False,
        )
        start_at = timezone.now() - timedelta(days=20)
        end_at = timezone.now() + timedelta(days=10)
        Subscription.objects.create(
            salon=salon,
            plan=self.plan,
            start_at=start_at,
            end_at=end_at,
            status='active',
        )

        response = self.client.post(
            '/api/rpc/admin_set_salon_status/',
            {'_salon_id':str(salon.id),'_status':'approved'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.json())
        subscription = SalonSubscription.objects.get(salon=salon)
        self.assertEqual(subscription.status, 'active')
        self.assertEqual(subscription.started_at, start_at)
        self.assertEqual(subscription.expires_at, end_at)
        self.assertIsNone(subscription.trial_start_date)
        self.assertEqual(Subscription.objects.get(salon=salon).status, 'active')

    def test_reapproval_without_prior_subscription_does_not_grant_a_second_trial(self):
        salon = Salon.objects.create(
            owner=self.salon.owner,
            name='Previously Approved Salon',
            slug='previously-approved-salon',
            status='rejected',
            is_active=False,
            approved_at=timezone.now() - timedelta(days=20),
        )

        response = self.client.post(
            '/api/rpc/admin_set_salon_status/',
            {'_salon_id':str(salon.id),'_status':'approved'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.json())
        subscription = SalonSubscription.objects.get(salon=salon)
        self.assertEqual(subscription.status, 'expired')
        self.assertIsNone(subscription.trial_start_date)

    def test_approval_without_an_active_plan_leaves_salon_pending(self):
        self.plan.is_active = False
        self.plan.save(update_fields=['is_active'])
        salon = Salon.objects.create(
            owner=self.salon.owner,
            name='No Plan Salon',
            slug='no-plan-salon',
            status='pending',
            is_active=False,
        )

        response = self.client.post(
            '/api/rpc/admin_set_salon_status/',
            {'_salon_id':str(salon.id),'_status':'approved'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        salon.refresh_from_db()
        self.assertEqual(salon.status, 'pending')
        self.assertFalse(SalonSubscription.objects.filter(salon=salon).exists())


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


class NearbySalonTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Salon.objects.create(
            name='Near Salon',
            slug='near-salon',
            status='approved',
            is_active=True,
            latitude=20.3000000,
            longitude=85.8300000,
        )
        Salon.objects.create(
            name='Farther Salon',
            slug='farther-salon',
            status='approved',
            is_active=True,
            latitude=20.4000000,
            longitude=85.9000000,
        )
        Salon.objects.create(
            name='Pending Salon',
            slug='pending-salon',
            status='pending',
            is_active=False,
            latitude=20.3001000,
            longitude=85.8301000,
        )
        Salon.objects.create(
            name='Unmapped Salon',
            slug='unmapped-salon',
            status='approved',
            is_active=True,
        )

    def test_nearby_salon_search_is_public_sorted_and_only_returns_active_mapped_salons(self):
        response = self.client.get(
            '/api/salons/nearby/?lat=20.2961&lng=85.8245&limit=10'
        )

        self.assertEqual(response.status_code, 200, response.json())
        rows = response.json()
        self.assertEqual([row['salon_id'] for row in rows], [
            str(Salon.objects.get(slug='near-salon').id),
            str(Salon.objects.get(slug='farther-salon').id),
        ])
        self.assertLess(rows[0]['distance_km'], rows[1]['distance_km'])
        self.assertGreater(rows[0]['distance_km'], 0)

    def test_nearby_salon_search_honors_limit(self):
        response = self.client.get(
            '/api/salons/nearby/?lat=20.2961&lng=85.8245&limit=1'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_nearby_salon_search_rejects_invalid_coordinates_or_limit(self):
        for query in (
            '?lat=NaN&lng=85.8',
            '?lat=91&lng=85.8',
            '?lat=20.2&lng=-181',
            '?lat=20.2&lng=85.8&limit=501',
        ):
            with self.subTest(query=query):
                response = self.client.get('/api/salons/nearby/' + query)
                self.assertEqual(response.status_code, 400)

class ReverseGeocodeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        state = Location.objects.create(name='Odisha', level='state')
        Location.objects.create(name='Khordha', level='district', parent=state)

    @override_settings(REVERSE_GEOCODER_URL='')
    def test_reverse_geocoding_reports_unconfigured_private_service(self):
        response = self.client.get('/api/locations/reverse-geocode/?lat=20.3&lng=85.8')

        self.assertEqual(response.status_code, 503)
        self.assertIn('not configured', response.json()['error'])

    def test_reverse_geocoding_rejects_invalid_coordinates(self):
        for query in ('?lat=NaN&lng=85.8', '?lat=91&lng=85.8', '?lat=20.3&lng=-181'):
            with self.subTest(query=query):
                response = self.client.get('/api/locations/reverse-geocode/' + query)
                self.assertEqual(response.status_code, 400)

    @override_settings(REVERSE_GEOCODER_URL='http://nominatim:8080/reverse')
    @patch(
        'api.views.urlopen',
        return_value=BytesIO(
            b'{"display_name":"Patia, Khordha, Odisha, 751024","address":'
            b'{"neighbourhood":"Patia","state_district":"Khordha",'
            b'"state":"Odisha","postcode":"751024"}}'
        ),
    )
    def test_reverse_geocoding_returns_address_fields_from_configured_service(self, mocked_urlopen):
        response = self.client.get('/api/locations/reverse-geocode/?lat=20.3&lng=85.8')

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json(), {
            'address':'Patia, Khordha, Odisha, 751024',
            'area':'Patia',
            'district':'Khordha',
            'state':'Odisha',
            'pinCode':'751024',
        })
        request = mocked_urlopen.call_args.args[0]
        self.assertIn('lat=20.3', request.full_url)
        self.assertIn('lon=85.8', request.full_url)
        self.assertEqual(request.get_header('User-agent'), 'SalonX/1.0')

class LocationSeedTests(TestCase):
    def test_seed_command_loads_all_indian_states_and_districts_idempotently(self):
        call_command('seed_salonx')
        call_command('seed_salonx')

        self.assertEqual(Location.objects.filter(level='state').count(), 36)
        self.assertEqual(Location.objects.filter(level='district').count(), 784)
        state = Location.objects.get(level='state', name='Odisha')
        self.assertTrue(Location.objects.filter(
            level='district', parent=state, name='Khordha',
        ).exists())


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

    def test_customer_cannot_change_another_salon_coordinates(self):
        self.client.force_authenticate(self.customer)

        response = self.client.patch(
            f'/api/db/salons/?id={self.salon.id}',
            {'latitude':20.2961,'longitude':85.8245},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.salon.refresh_from_db()
        self.assertIsNone(self.salon.latitude)
        self.assertIsNone(self.salon.longitude)

    def test_salon_owner_can_add_coordinates_to_their_salon(self):
        owner = User.objects.create_user(
            username='salon-owner@example.test',
            email='salon-owner@example.test',
            password='ValidPass123!',
        )
        Profile.objects.create(id=owner, role='salon_owner')
        salon = Salon.objects.create(
            owner=owner,
            name='Owned Salon',
            slug='owned-salon',
            status='approved',
            is_active=True,
        )
        self.client.force_authenticate(owner)

        response = self.client.patch(
            f'/api/db/salons/?id={salon.id}',
            {'latitude':20.2961,'longitude':85.8245},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.json())
        salon.refresh_from_db()
        self.assertEqual(float(salon.latitude), 20.2961)
        self.assertEqual(float(salon.longitude), 85.8245)

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

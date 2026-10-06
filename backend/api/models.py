import uuid
from django.contrib.auth.models import User
from django.db import models

class Profile(models.Model):
    id=models.OneToOneField(User,primary_key=True,on_delete=models.CASCADE,related_name='profile')
    @property
    def user(self): return self.id
    full_name=models.CharField(max_length=160,blank=True)
    email=models.EmailField(blank=True)
    city=models.CharField(max_length=100,blank=True)
    phone=models.CharField(max_length=30,blank=True)
    avatar_url=models.URLField(blank=True)
    role=models.CharField(max_length=30,default='customer')
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)

class UserRole(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    user=models.ForeignKey(User,on_delete=models.CASCADE,related_name='roles')
    role=models.CharField(max_length=30)
    class Meta: constraints=[models.UniqueConstraint(fields=['user','role'],name='user_role_unique')]

class Salon(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    owner=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='salons')
    name=models.CharField(max_length=200); slug=models.SlugField(max_length=220,unique=True)
    description=models.TextField(blank=True); phone=models.CharField(max_length=30,blank=True)
    email=models.EmailField(blank=True); address=models.TextField(blank=True); city=models.CharField(max_length=100,blank=True)
    district=models.CharField(max_length=100,blank=True); state=models.CharField(max_length=100,default='Odisha')
    area=models.CharField(max_length=120,blank=True)
    about=models.TextField(blank=True)
    image_url=models.URLField(blank=True)
    salon_images=models.JSONField(default=list,blank=True)
    salon_type=models.CharField(max_length=80,blank=True)
    seats=models.PositiveIntegerField(null=True,blank=True)
    years_in_business=models.PositiveIntegerField(null=True,blank=True)
    whatsapp_number=models.CharField(max_length=30,blank=True)
    latitude=models.DecimalField(max_digits=10,decimal_places=7,null=True,blank=True)
    longitude=models.DecimalField(max_digits=10,decimal_places=7,null=True,blank=True)
    opening_time=models.TimeField(null=True,blank=True)
    closing_time=models.TimeField(null=True,blank=True)
    weekly_closed_day=models.PositiveSmallIntegerField(null=True,blank=True)
    booking_interval_min=models.PositiveIntegerField(default=10)
    buffer_min=models.PositiveIntegerField(default=0)
    timezone=models.CharField(max_length=64,default='Asia/Kolkata')
    pincode=models.CharField(max_length=20,blank=True); logo_url=models.URLField(blank=True); cover_image_url=models.URLField(blank=True)
    rating=models.DecimalField(max_digits=3,decimal_places=2,default=0); review_count=models.PositiveIntegerField(default=0); starting_price=models.DecimalField(max_digits=10,decimal_places=2,default=0)
    is_verified=models.BooleanField(default=False); is_featured=models.BooleanField(default=False); home_service_enabled=models.BooleanField(default=False)
    rejection_reason=models.TextField(blank=True); rejected_at=models.DateTimeField(null=True,blank=True)
    instagram_url=models.URLField(blank=True); facebook_url=models.URLField(blank=True); website_url=models.URLField(blank=True); services_offered=models.JSONField(default=list,blank=True)
    status=models.CharField(max_length=30,default='pending'); is_active=models.BooleanField(default=True); approved_at=models.DateTimeField(null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)

class ServiceCategory(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); name=models.CharField(max_length=120,unique=True)
    description=models.TextField(blank=True); image_url=models.URLField(blank=True); is_active=models.BooleanField(default=True); created_at=models.DateTimeField(auto_now_add=True)
class Service(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); salon=models.ForeignKey(Salon,on_delete=models.CASCADE,related_name='services'); category=models.ForeignKey(ServiceCategory,null=True,blank=True,on_delete=models.SET_NULL)
    name=models.CharField(max_length=160); description=models.TextField(blank=True); image_url=models.URLField(blank=True); price=models.DecimalField(max_digits=10,decimal_places=2); duration_minutes=models.PositiveIntegerField(default=30); is_active=models.BooleanField(default=True); created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
class Hairstyle(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); salon=models.ForeignKey(Salon,null=True,blank=True,on_delete=models.CASCADE,related_name='hairstyles'); name=models.CharField(max_length=160); category=models.CharField(max_length=120,blank=True); image_url=models.URLField(blank=True); price=models.DecimalField(max_digits=10,decimal_places=2,default=0); duration_minutes=models.PositiveIntegerField(default=30); description=models.TextField(blank=True); gender=models.CharField(max_length=40,default='unisex'); is_bookable=models.BooleanField(default=True); is_active=models.BooleanField(default=True); is_featured=models.BooleanField(default=False); created_at=models.DateTimeField(auto_now_add=True)
class WeddingPackage(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); salon=models.ForeignKey(Salon,on_delete=models.CASCADE,related_name='wedding_packages'); name=models.CharField(max_length=160); description=models.TextField(blank=True); image_url=models.URLField(blank=True); price=models.DecimalField(max_digits=10,decimal_places=2); duration_minutes=models.PositiveIntegerField(default=60); is_active=models.BooleanField(default=True)
class Booking(models.Model):
    STATUS=[('pending','Pending'),('confirmed','Confirmed'),('cancelled','Cancelled'),('completed','Completed'),('no_show','No-show')]
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); salon=models.ForeignKey(Salon,on_delete=models.PROTECT); customer=models.ForeignKey(User,on_delete=models.PROTECT,related_name='bookings'); service=models.ForeignKey(Service,null=True,blank=True,on_delete=models.PROTECT); hairstyle=models.ForeignKey(Hairstyle,null=True,blank=True,on_delete=models.PROTECT); wedding_package=models.ForeignKey(WeddingPackage,null=True,blank=True,on_delete=models.PROTECT)
    date=models.DateField(); start_time=models.TimeField(); end_time=models.TimeField(); duration_minutes=models.PositiveIntegerField(); chair_number=models.PositiveIntegerField(null=True,blank=True); amount=models.DecimalField(max_digits=10,decimal_places=2,default=0); discount_amount=models.DecimalField(max_digits=10,decimal_places=2,default=0); notes=models.TextField(blank=True); cancellation_reason=models.TextField(blank=True); status=models.CharField(max_length=20,choices=STATUS,default='pending'); created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
class Payment(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); booking=models.OneToOneField(Booking,on_delete=models.CASCADE,related_name='payment'); salon=models.ForeignKey(Salon,on_delete=models.PROTECT); customer=models.ForeignKey(User,on_delete=models.PROTECT); amount=models.DecimalField(max_digits=10,decimal_places=2); method=models.CharField(max_length=40,default='pay_at_salon'); status=models.CharField(max_length=30,default='pending'); provider_ref=models.CharField(max_length=160,blank=True); paid_at=models.DateTimeField(null=True,blank=True); confirmed_by=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='+'); confirmed_at=models.DateTimeField(null=True,blank=True); note=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True)
class LoyaltyRule(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); salon=models.OneToOneField(Salon,null=True,blank=True,on_delete=models.CASCADE); points_per_hundred=models.PositiveIntegerField(default=10); point_value_rupees=models.DecimalField(max_digits=10,decimal_places=2,default=1); min_redeem_points=models.PositiveIntegerField(default=50); max_redeem_percent=models.PositiveIntegerField(default=50); is_active=models.BooleanField(default=True)
class LoyaltyAccount(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); customer=models.ForeignKey(User,on_delete=models.CASCADE); salon=models.ForeignKey(Salon,on_delete=models.CASCADE); balance=models.IntegerField(default=0); total_earned=models.IntegerField(default=0); total_redeemed=models.IntegerField(default=0); updated_at=models.DateTimeField(auto_now=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['customer','salon'],name='loyalty_customer_salon_unique')]
class Notification(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); user=models.ForeignKey(User,on_delete=models.CASCADE); title=models.CharField(max_length=200); body=models.TextField(blank=True); is_read=models.BooleanField(default=False); created_at=models.DateTimeField(auto_now_add=True)
class ContactMessage(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); user=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL); name=models.CharField(max_length=120); email=models.EmailField(null=True,blank=True); phone=models.CharField(max_length=30,blank=True); subject=models.CharField(max_length=200,blank=True); message=models.TextField(); status=models.CharField(max_length=30,default='new'); created_at=models.DateTimeField(auto_now_add=True)
class SupportTicket(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); user=models.ForeignKey(User,on_delete=models.CASCADE); salon=models.ForeignKey(Salon,null=True,blank=True,on_delete=models.CASCADE); subject=models.CharField(max_length=200); description=models.TextField(); status=models.CharField(max_length=30,default='open'); priority=models.CharField(max_length=20,default='medium'); created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
class SubscriptionPlan(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); code=models.CharField(max_length=100,unique=True,default='all_in_one')
    name=models.CharField(max_length=100,unique=True); price=models.DecimalField(max_digits=10,decimal_places=2,default=0)
    billing_cycle=models.CharField(max_length=30,default='monthly'); billing_days=models.PositiveIntegerField(null=True,blank=True)
    trial_enabled=models.BooleanField(default=True); trial_days=models.PositiveIntegerField(default=14)
    description=models.TextField(blank=True); currency=models.CharField(max_length=10,default='INR'); features=models.JSONField(default=list,blank=True)
    is_active=models.BooleanField(default=True)

class Subscription(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); salon=models.OneToOneField(Salon,on_delete=models.CASCADE,related_name='subscription'); plan=models.ForeignKey(SubscriptionPlan,on_delete=models.PROTECT); start_at=models.DateTimeField(); end_at=models.DateTimeField(); status=models.CharField(max_length=30,default='trial'); created_at=models.DateTimeField(auto_now_add=True)
class Location(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); name=models.CharField(max_length=120); level=models.CharField(max_length=20); parent=models.ForeignKey('self',null=True,blank=True,on_delete=models.CASCADE); code=models.CharField(max_length=30,blank=True); is_active=models.BooleanField(default=True)


class DemoRequest(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    owner_name=models.CharField(max_length=160); salon_name=models.CharField(max_length=200)
    phone=models.CharField(max_length=30); email=models.EmailField()
    city=models.CharField(max_length=100,blank=True); state=models.CharField(max_length=100,blank=True)
    district=models.CharField(max_length=100,blank=True); address=models.TextField(blank=True)
    branches=models.PositiveIntegerField(default=1); message=models.TextField(blank=True)
    status=models.CharField(max_length=30,default='pending')
    created_salon=models.ForeignKey(Salon,null=True,blank=True,on_delete=models.SET_NULL,related_name='demo_requests')
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)

class PaymentGatewaySettings(models.Model):
    PROVIDERS=[('razorpay','Razorpay'),('phonepe','PhonePe')]
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    provider=models.CharField(max_length=30,choices=PROVIDERS,unique=True)
    display_name=models.CharField(max_length=100,default='Payment Gateway')
    is_enabled=models.BooleanField(default=False); is_active_gateway=models.BooleanField(default=False)
    environment=models.CharField(max_length=20,default='test'); public_key=models.CharField(max_length=255,blank=True)
    connection_status=models.CharField(max_length=30,default='not_connected'); connection_message=models.TextField(blank=True)
    last_verified_at=models.DateTimeField(null=True,blank=True)
    key_id=models.CharField(max_length=255,blank=True); key_secret=models.CharField(max_length=500,blank=True)
    merchant_id=models.CharField(max_length=255,blank=True); merchant_key=models.CharField(max_length=500,blank=True)
    updated_at=models.DateTimeField(auto_now=True)

class AppFeature(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    code=models.CharField(max_length=120,unique=True); name=models.CharField(max_length=160)
    group_name=models.CharField(max_length=120,default='General'); description=models.TextField(blank=True)
    is_active=models.BooleanField(default=True); sort_order=models.PositiveIntegerField(default=0)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)

class SalonResource(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    salon=models.ForeignKey(Salon,on_delete=models.CASCADE,related_name='resources')
    name=models.CharField(max_length=120); sort_order=models.PositiveIntegerField(default=0); is_active=models.BooleanField(default=True)
    class Meta: ordering=['sort_order','name']

class SalonClosure(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    salon=models.ForeignKey(Salon,on_delete=models.CASCADE,related_name='closures')
    closed_date=models.DateField(); reason=models.CharField(max_length=255,blank=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['salon','closed_date'],name='salon_closure_unique')]

class SalonHour(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    salon=models.ForeignKey(Salon,on_delete=models.CASCADE,related_name='hours')
    weekday=models.PositiveSmallIntegerField(); open_time=models.TimeField(null=True,blank=True); close_time=models.TimeField(null=True,blank=True); is_closed=models.BooleanField(default=False)
    class Meta: constraints=[models.UniqueConstraint(fields=['salon','weekday'],name='salon_hour_unique')]

class SalonBlock(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    salon=models.ForeignKey(Salon,on_delete=models.CASCADE,related_name='blocks')
    block_date=models.DateField(); start_time=models.TimeField(); end_time=models.TimeField(); reason=models.CharField(max_length=255,blank=True)

class Review(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    salon=models.ForeignKey(Salon,on_delete=models.CASCADE,related_name='reviews')
    customer=models.ForeignKey(User,on_delete=models.CASCADE)
    booking=models.OneToOneField(Booking,on_delete=models.CASCADE,related_name='review')
    service=models.ForeignKey(Service,null=True,blank=True,on_delete=models.SET_NULL)
    rating=models.PositiveSmallIntegerField(); comment=models.TextField(blank=True); owner_reply=models.TextField(blank=True)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)

class LoyaltyTransaction(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    customer=models.ForeignKey(User,on_delete=models.CASCADE); salon=models.ForeignKey(Salon,on_delete=models.CASCADE)
    booking=models.ForeignKey(Booking,null=True,blank=True,on_delete=models.SET_NULL)
    points=models.IntegerField(); kind=models.CharField(max_length=20); reason=models.CharField(max_length=255,blank=True); created_at=models.DateTimeField(auto_now_add=True)

class SubscriptionStatusHistory(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    salon=models.ForeignKey(Salon,on_delete=models.CASCADE); status=models.CharField(max_length=40); note=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True)

class SalonSubscription(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    salon=models.OneToOneField(Salon,on_delete=models.CASCADE,related_name='salon_subscription')
    owner=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL)
    plan=models.ForeignKey(SubscriptionPlan,on_delete=models.PROTECT)
    status=models.CharField(max_length=30,default='trialing')
    started_at=models.DateTimeField(); expires_at=models.DateTimeField()
    trial_start_date=models.DateTimeField(null=True,blank=True); trial_end_date=models.DateTimeField(null=True,blank=True)
    auto_renew=models.BooleanField(default=False); cancelled_at=models.DateTimeField(null=True,blank=True); suspended_at=models.DateTimeField(null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)

class LegacyRecord(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    resource=models.CharField(max_length=120,db_index=True)
    data=models.JSONField(default=dict)
    owner=models.ForeignKey(User,null=True,blank=True,on_delete=models.SET_NULL)
    created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True)
    class Meta: indexes=[models.Index(fields=['resource','created_at'])]

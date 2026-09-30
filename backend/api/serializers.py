from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from .models import *

class UserSerializer(serializers.ModelSerializer):
    full_name=serializers.CharField(source='profile.full_name',read_only=True)
    role=serializers.CharField(source='profile.role',read_only=True)
    class Meta: model=User; fields=['id','email','username','full_name','role']
class _LegacyRegisterSerializer(serializers.Serializer):
    email=serializers.EmailField(); password=serializers.CharField(min_length=8,write_only=True); full_name=serializers.CharField(required=False,allow_blank=True); phone=serializers.CharField(required=False,allow_blank=True); role=serializers.ChoiceField(choices=['customer','owner'],default='customer')
    def create(self, data):
        email=data['email'].lower().strip(); user=User.objects.create_user(username=email,email=email,password=data['password']); Profile.objects.create(id=user,full_name=data.get('full_name',''),phone=data.get('phone',''),role='salon_owner' if data.get('role')=='owner' else data.get('role','customer')); UserRole.objects.create(user=user,role='salon_owner' if data.get('role')=='owner' else data.get('role','customer')); return user
class RegisterSerializer(serializers.Serializer):
    email=serializers.EmailField(max_length=150)
    password=serializers.CharField(write_only=True,min_length=8,trim_whitespace=False)
    full_name=serializers.CharField(required=False,allow_blank=True,max_length=160)
    phone=serializers.CharField(required=False,allow_blank=True,max_length=30)
    role=serializers.ChoiceField(choices=['customer','owner'],default='customer')

    def validate_email(self, value):
        email=value.lower().strip()
        if User.objects.filter(Q(email__iexact=email) | Q(username__iexact=email)).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        return value

    @transaction.atomic
    def create(self, data):
        email=data['email']
        account_role='salon_owner' if data.get('role')=='owner' else 'customer'
        user=User.objects.create_user(username=email,email=email,password=data['password'])
        Profile.objects.create(id=user,full_name=data.get('full_name','').strip(),phone=data.get('phone','').strip(),role=account_role)
        UserRole.objects.create(user=user,role=account_role)
        return user


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta: model=UserRole; fields='__all__'
class ProfileSerializer(serializers.ModelSerializer):
    class Meta: model=Profile; fields='__all__'; read_only_fields=['id','user','created_at','updated_at']
class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta: model=ServiceCategory; fields='__all__'; read_only_fields=['id','created_at']
class ServiceSerializer(serializers.ModelSerializer):
    duration_min=serializers.IntegerField(source='duration_minutes',required=False)
    class Meta: model=Service; fields='__all__'; read_only_fields=['id','created_at','updated_at']
class HairstyleSerializer(serializers.ModelSerializer):
    duration_min=serializers.IntegerField(source='duration_minutes',required=False)
    class Meta: model=Hairstyle; fields='__all__'; read_only_fields=['id','created_at']
class WeddingPackageSerializer(serializers.ModelSerializer):
    duration_min=serializers.IntegerField(source='duration_minutes',required=False)
    class Meta: model=WeddingPackage; fields='__all__'
class PaymentSerializer(serializers.ModelSerializer):
    class Meta: model=Payment; fields='__all__'; read_only_fields=['id','confirmed_by','confirmed_at','created_at']
class LoyaltyRuleSerializer(serializers.ModelSerializer):
    class Meta: model=LoyaltyRule; fields='__all__'
class LoyaltyAccountSerializer(serializers.ModelSerializer):
    class Meta: model=LoyaltyAccount; fields='__all__'; read_only_fields=['id','balance','total_earned','total_redeemed','updated_at']
class NotificationSerializer(serializers.ModelSerializer):
    class Meta: model=Notification; fields='__all__'; read_only_fields=['id','user','created_at']
class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta: model=ContactMessage; fields='__all__'; read_only_fields=['id','created_at']
class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta: model=SupportTicket; fields='__all__'; read_only_fields=['id','user','created_at','updated_at']
class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta: model=SubscriptionPlan; fields='__all__'
class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta: model=Subscription; fields='__all__'
class LocationSerializer(serializers.ModelSerializer):
    class Meta: model=Location; fields='__all__'


class SalonSerializer(serializers.ModelSerializer):
    owner_id=serializers.IntegerField(read_only=True)
    pin_code=serializers.CharField(source='pincode',required=False,allow_blank=True)
    class Meta:
        model=Salon
        fields='__all__'
        read_only_fields=['id','owner','created_at','updated_at','approved_at']

class PublicSalonSerializer(serializers.ModelSerializer):
    pin_code=serializers.CharField(source='pincode',read_only=True)
    class Meta:
        model=Salon
        fields=[
            'id','slug','name','description','about','address','city','district','state','area',
            'pin_code','image_url','logo_url','cover_image_url','salon_images','salon_type',
            'latitude','longitude','opening_time','closing_time','weekly_closed_day','rating',
            'review_count','starting_price','is_verified','is_featured','home_service_enabled',
            'instagram_url','facebook_url','website_url','services_offered','status','is_active',
        ]

class BookingSerializer(serializers.ModelSerializer):
    salon_id=serializers.UUIDField(read_only=True)
    customer_id=serializers.IntegerField(read_only=True)
    service_id=serializers.UUIDField(read_only=True,allow_null=True)
    hairstyle_id=serializers.UUIDField(read_only=True,allow_null=True)
    wedding_package_id=serializers.UUIDField(read_only=True,allow_null=True)
    booking_date=serializers.DateField(source='date',required=False)
    slot_time=serializers.TimeField(source='start_time',required=False)
    duration_min=serializers.IntegerField(source='duration_minutes',required=False)
    package_id=serializers.UUIDField(source='wedding_package_id',read_only=True,allow_null=True)
    class Meta:
        model=Booking
        fields='__all__'
        read_only_fields=['id','customer','created_at','updated_at']

class DemoRequestSerializer(serializers.ModelSerializer):
    class Meta: model=DemoRequest; fields='__all__'; read_only_fields=['id','created_at','updated_at']

class PaymentGatewaySettingsSerializer(serializers.ModelSerializer):
    class Meta: model=PaymentGatewaySettings; fields='__all__'; extra_kwargs={'key_secret':{'write_only':True},'merchant_key':{'write_only':True}}

class AppFeatureSerializer(serializers.ModelSerializer):
    class Meta: model=AppFeature; fields='__all__'; read_only_fields=['id','created_at','updated_at']

class SalonResourceSerializer(serializers.ModelSerializer):
    class Meta: model=SalonResource; fields='__all__'; read_only_fields=['id']

class SalonClosureSerializer(serializers.ModelSerializer):
    class Meta: model=SalonClosure; fields='__all__'; read_only_fields=['id']

class SalonHourSerializer(serializers.ModelSerializer):
    class Meta: model=SalonHour; fields='__all__'; read_only_fields=['id']

class SalonBlockSerializer(serializers.ModelSerializer):
    class Meta: model=SalonBlock; fields='__all__'; read_only_fields=['id']

class ReviewSerializer(serializers.ModelSerializer):
    class Meta: model=Review; fields='__all__'; read_only_fields=['id','customer','created_at','updated_at']

class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    class Meta: model=LoyaltyTransaction; fields='__all__'; read_only_fields=['id','created_at']

class SubscriptionStatusHistorySerializer(serializers.ModelSerializer):
    class Meta: model=SubscriptionStatusHistory; fields='__all__'; read_only_fields=['id','created_at']

class SalonSubscriptionSerializer(serializers.ModelSerializer):
    class Meta: model=SalonSubscription; fields='__all__'; read_only_fields=['id']


class LegacyRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model=LegacyRecord
        fields='__all__'
        read_only_fields=['id','created_at','updated_at']

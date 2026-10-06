from datetime import timedelta as datetime_timedelta
import json
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.conf import settings
from django.db import models
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from .throttles import CostumThrottle, LoginRateThrottle, SupportContactThrottle, ApiResourceThrottle
from .models import *
from .serializers import *
from .permissions import IsAdmin, IsOwnerOrAdmin, role





@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return JsonResponse({
        'status':'ok',
        'service':'salonx-django',
        'database':settings.DATABASES['default']['ENGINE'].rsplit('.',1)[-1],
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def admin_status(request):
    super_admin_count = UserRole.objects.filter(role='super_admin').count()
    super_admin_count += User.objects.filter(is_staff=True).exclude(
        id__in=UserRole.objects.filter(role='super_admin').values('user_id')
    ).count()
    return Response({'super_admin_count':super_admin_count})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([SupportContactThrottle])
def subscription_contact_admin(request):
    salon_id=request.data.get('salon_id')
    if not salon_id:
        return Response({'error':'Salon ID is required.'},status=400)
    salon=Salon.objects.filter(id=salon_id,owner=request.user).first()
    if not salon:
        return Response({'error':'You may only contact admin about your own salon.'},status=404)

    subscription=Subscription.objects.filter(salon=salon).first()
    if subscription:
        subscription_status=subscription.status
        expiry=subscription.end_at
        priority='high' if expiry and expiry<=timezone.now() else 'medium'
        expiry_label=expiry.isoformat() if expiry else 'not set'
    else:
        subscription_status='not started'
        priority='high'
        expiry_label='not set'

    ticket=SupportTicket.objects.create(
        user=request.user,
        salon=salon,
        subject='Subscription help request',
        description=(
            f"Category: renewal\n\nPlease help with my SalonX subscription. "
            f"Current status: {subscription_status}. Expiry: {expiry_label}."
        ),
        priority=priority,
    )
    return Response({'id':str(ticket.id)},status=201)

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    s=RegisterSerializer(data=request.data); s.is_valid(raise_exception=True)
    if User.objects.filter(email=s.validated_data['email'].lower()).exists(): return Response({'error':'Email already registered'},status=400)
    user=s.save(); refresh=RefreshToken.for_user(user)
    return Response({'user':UserSerializer(user).data,'access':str(refresh.access_token),'refresh':str(refresh) },status=201)

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([CostumThrottle, LoginRateThrottle])
def login(request):
    email=str(request.data.get('email','')).lower().strip(); password=request.data.get('password','')
    account=User.objects.filter(email__iexact=email).first()
    user=authenticate(username=account.username,password=password) if account else None
    if not user or not user.is_active: return Response({'error':'Invalid credentials'},status=401)
    refresh=RefreshToken.for_user(user); return Response({'user':UserSerializer(user).data,'access':str(refresh.access_token),'refresh':str(refresh)})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request): return Response(UserSerializer(request.user).data)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def password_change(request):
    password=str(request.data.get('password',''))
    if len(password)<8: return Response({'error':'Password must be at least 8 characters.'},status=400)
    request.user.set_password(password); request.user.save(update_fields=['password']); return Response({'ok':True})

@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    return Response(
        {'error':'Password reset email delivery is not configured.'},
        status=status.HTTP_501_NOT_IMPLEMENTED,
    )


MODEL_MAP={
 'profiles':(Profile,ProfileSerializer),'user_roles':(UserRole,UserRoleSerializer),
 'salons':(Salon,SalonSerializer),'service_categories':(ServiceCategory,ServiceCategorySerializer),
 'services':(Service,ServiceSerializer),'hairstyles':(Hairstyle,HairstyleSerializer),
 'hairstyle_catalog':(Hairstyle,HairstyleSerializer),'wedding_packages':(WeddingPackage,WeddingPackageSerializer),
 'bookings':(Booking,BookingSerializer),'payments':(Payment,PaymentSerializer),
 'loyalty_rules':(LoyaltyRule,LoyaltyRuleSerializer),'loyalty_accounts':(LoyaltyAccount,LoyaltyAccountSerializer),
 'loyalty_transactions':(LoyaltyTransaction,LoyaltyTransactionSerializer),
 'notifications':(Notification,NotificationSerializer),'contact_messages':(ContactMessage,ContactMessageSerializer),
 'support_tickets':(SupportTicket,SupportTicketSerializer),'subscription_plans':(SubscriptionPlan,SubscriptionPlanSerializer),
 'subscriptions':(Subscription,SubscriptionSerializer),'locations':(Location,LocationSerializer),
 'demo_requests':(DemoRequest,DemoRequestSerializer),'payment_gateway_settings':(PaymentGatewaySettings,PaymentGatewaySettingsSerializer),
 'app_features':(AppFeature,AppFeatureSerializer),'salon_resources':(SalonResource,SalonResourceSerializer),
 'salon_closures':(SalonClosure,SalonClosureSerializer),'salon_hours':(SalonHour,SalonHourSerializer),
 'salon_blocks':(SalonBlock,SalonBlockSerializer),'reviews':(Review,ReviewSerializer),
 'subscription_status_history':(SubscriptionStatusHistory,SubscriptionStatusHistorySerializer),
 'salon_subscriptions':(SalonSubscription,SalonSubscriptionSerializer), 'legacy':(LegacyRecord,LegacyRecordSerializer),
}
PUBLIC={'salons','service_categories','services','hairstyles','hairstyle_catalog','wedding_packages','locations','subscription_plans','app_features','coupons'}
ADMIN_ONLY={'service_categories','locations','subscription_plans','app_features','payment_gateway_settings'}
SENSITIVE={'contact_messages','demo_requests','payment_gateway_settings','subscription_status_history'}
QUERY_ALIASES={
    'booking_date':'date',
    'slot_time':'start_time',
    'duration_min':'duration_minutes',
    'pin_code':'pincode',
    'package_id':'wedding_package_id',
}

def is_admin_user(user):
    return user.is_authenticated and (user.is_staff or role(user)=='super_admin')

def scoped_queryset(queryset, resource, user):
    if not user.is_authenticated:
        return queryset
    if is_admin_user(user):
        return queryset
    user_id=user.pk
    if resource=='salons':
        return queryset.filter(Q(status='approved',is_active=True)|Q(owner_id=user_id))
    if resource in {'services','hairstyles','hairstyle_catalog','wedding_packages','salon_resources','salon_closures','salon_hours','salon_blocks'}:
        return queryset.filter(Q(salon__status='approved',salon__is_active=True)|Q(salon__owner_id=user_id))
    if resource=='profiles': return queryset.filter(pk=user_id)
    if resource=='user_roles': return queryset.filter(user_id=user_id)
    if resource in {'bookings','payments'}:
        return queryset.filter(Q(customer_id=user_id)|Q(salon__owner_id=user_id))
    if resource in {'notifications','support_tickets','loyalty_accounts'}:
        if resource=='loyalty_accounts':
            return queryset.filter(Q(customer_id=user_id)|Q(salon__owner_id=user_id))
        return queryset.filter(user_id=user_id)
    if resource in {'loyalty_transactions','reviews'}:
        return queryset.filter(Q(customer_id=user_id)|Q(salon__owner_id=user_id))
    if resource=='subscription_status_history':
        return queryset.filter(salon__owner_id=user_id)
    if resource in {'subscriptions','salon_subscriptions'}:
        return queryset.filter(salon__owner_id=user_id)
    if resource in {'subscription_plans','app_features','service_categories','locations'}:
        return queryset
    if resource=='legacy':
        return queryset.filter(owner_id=user_id)
    if resource=='salon_categories':
        owned_salons=Salon.objects.filter(owner_id=user_id).values('id')
        return queryset.filter(
            resource=resource,
            owner_id=user_id,
            data__salon_id__in=[str(salon_id) for salon_id in owned_salons],
        )
    return queryset.none()


def query_field_name(model, name):
    name=QUERY_ALIASES.get(name,name)
    fields={f.name:f for f in model._meta.get_fields() if getattr(f,'concrete',False)}
    fields.update({f.attname:f for f in model._meta.get_fields() if getattr(f,'concrete',False)})
    field=fields.get(name)
    if field is None or not getattr(field,'concrete',False):
        return None
    return name

def apply_query_filter(queryset, model, key, value):
    operators=('not_is','ilike','gte','lte','neq','in','is','gt','lt')
    field_name=key
    operator='eq'
    for candidate in operators:
        suffix=f'__{candidate}'
        if key.endswith(suffix):
            field_name=key[:-len(suffix)]
            operator=candidate
            break
    field_name=query_field_name(model,field_name)
    if not field_name:
        return queryset
    field=next(
        (candidate for candidate in model._meta.get_fields()
         if getattr(candidate,'concrete',False)
         and field_name in {candidate.name,getattr(candidate,'attname',candidate.name)}),
        None,
    )
    def normalized_value(raw):
        if isinstance(field,models.BooleanField):
            normalized=raw.strip().lower()
            if normalized in {'true','1','yes','on'}: return True
            if normalized in {'false','0','no','off'}: return False
            raise DRFValidationError({field_name:'Expected a boolean value (true or false).'})
        return raw
    if operator=='in': return queryset.filter(**{f'{field_name}__in':[normalized_value(item) for item in value.split(',')]})
    if operator=='neq': return queryset.exclude(**{field_name:normalized_value(value)})
    if operator=='is':
        if isinstance(field,models.BooleanField) and value.lower() in {'true','false','1','0','yes','no','on','off'}:
            return queryset.filter(**{field_name:normalized_value(value)})
        return queryset.filter(**{f'{field_name}__isnull':value.lower() in ('true','null')})
    if operator=='not_is':
        if isinstance(field,models.BooleanField) and value.lower() in {'true','false','1','0','yes','no','on','off'}:
            return queryset.exclude(**{field_name:normalized_value(value)})
        return queryset.exclude(**{f'{field_name}__isnull':value.lower() in ('true','null')})
    if operator=='ilike': return queryset.filter(**{f'{field_name}__icontains':value.strip('%')})
    if operator in {'gte','lte','gt','lt'}: return queryset.filter(**{f'{field_name}__{operator}':value})
    return queryset.filter(**{field_name:normalized_value(value)})

def parse_selected_fields(expression):
    fields=[]
    depth=0
    start=0
    for index,char in enumerate(expression):
        if char=='(': depth+=1
        elif char==')': depth=max(0,depth-1)
        elif char==',' and depth==0:
            fields.append(expression[start:index].strip())
            start=index+1
    fields.append(expression[start:].strip())
    return [field for field in fields if field]

RELATED_RESOURCE_ALIASES={
    'salons':('salon','salons'),
    'services':('service','services'),
    'hairstyles':('hairstyle','hairstyles'),
    'wedding_packages':('wedding_package','wedding_packages'),
    'subscription_plans':('plan','subscription_plans'),
}

def add_foreign_key_ids(data, obj):
    for field in obj._meta.get_fields():
        if getattr(field,'concrete',False) and getattr(field,'many_to_one',False):
            data[field.attname]=getattr(obj,field.attname)
    return data

def serialize_selected_rows(rows, serializer_class, model, selected_fields):
    serialized=[]
    for obj in rows:
        data=add_foreign_key_ids(serializer_class(obj).data.copy(),obj)
        output={}
        for selected in selected_fields:
            if '(' not in selected:
                if selected in data: output[selected]=data[selected]
                continue
            opening=selected.find('(')
            descriptor=selected[:opening].strip()
            relation_name=descriptor.split(':',1)[0]
            requested_relation=descriptor.split(':',1)[1] if ':' in descriptor else relation_name
            if not selected.endswith(')'):
                continue
            relation_fields=parse_selected_fields(selected[opening+1:-1])
            relation_field,resource=RELATED_RESOURCE_ALIASES.get(
                requested_relation,
                (requested_relation[:-3] if requested_relation.endswith('_id') else requested_relation,requested_relation),
            )
            if relation_name=='profiles' and relation_field=='customer':
                customer=getattr(obj,'customer',None)
                if customer is None:
                    output[relation_name]=None
                    continue
                profile=Profile.objects.filter(pk=customer.pk).first()
                related_data={
                    'full_name':profile.full_name if profile else '',
                    'phone':profile.phone if profile else '',
                    'email':customer.email,
                }
                output[relation_name]={name:related_data[name] for name in relation_fields if name in related_data}
                continue
            if relation_field not in {field.name for field in model._meta.get_fields()}:
                continue
            relation=getattr(obj,relation_field,None)
            if relation is None:
                output[relation_name]=None
                continue
            related_serializer=MODEL_MAP.get(resource,(None,None))[1] if resource else None
            if not related_serializer:
                continue
            related_data=add_foreign_key_ids(related_serializer(relation).data.copy(),relation)
            output[relation_name]={name:related_data[name] for name in relation_fields if name in related_data}
        serialized.append(output)
    return serialized

class ResourcePermission(BasePermission):
    def has_permission(self, request, view):
        resource=view.kwargs.get('resource')
        if request.method=='GET' and resource in PUBLIC:
            return True
        if request.method=='POST' and resource=='contact_messages':
            return True
        return bool(request.user and request.user.is_authenticated)

@api_view(['GET','POST','PATCH','PUT','DELETE'])
@permission_classes([ResourcePermission])
@throttle_classes([AnonRateThrottle, ApiResourceThrottle])
def db_resource(request, resource):
    is_legacy = resource not in MODEL_MAP
    Model,Ser = (LegacyRecord,LegacyRecordSerializer) if is_legacy else MODEL_MAP[resource]
    if is_legacy:
        qs=Model.objects.filter(resource=resource)
        if (
            request.user.is_authenticated
            and not (request.user.is_staff or role(request.user)=='super_admin')
            and not (resource=='coupons' and request.method=='GET')
        ):
            qs=qs.filter(owner=request.user)
        if request.method=='GET':
            rows=[]
            for obj in qs.order_by('-created_at'):
                row={'id':str(obj.id), **(obj.data or {}), 'created_at':obj.created_at, 'updated_at':obj.updated_at}
                ok=True
                for k,v in request.query_params.items():
                    if k in {'limit','offset','order','select','single','maybe_single','or','count','head'}: continue
                    if k.endswith('__in'):
                        if str(row.get(k[:-4])) not in v.split(','): ok=False
                    elif k.endswith('__ilike'):
                        if str(v).strip('%').lower() not in str(row.get(k[:-7],'')).lower(): ok=False
                    elif k.endswith('__gte') and str(row.get(k[:-5],'')) < str(v): ok=False
                    elif k.endswith('__lte') and str(row.get(k[:-5],'')) > str(v): ok=False
                    elif k in row:
                        row_value=row.get(k)
                        if isinstance(row_value,bool):
                            requested=str(v).lower()
                            if requested in {'true','1','yes','on'}:
                                matches=True
                            elif requested in {'false','0','no','off'}:
                                matches=False
                            else:
                                matches=None
                            if matches is None or row_value!=matches: ok=False
                        elif str(row_value)!=str(v):
                            ok=False
                if ok: rows.append(row)
            order=request.query_params.get('order','-created_at')
            for key in reversed(order.split(',')):
                descending=key.startswith('-')
                field=key.lstrip('-')
                rows.sort(key=lambda row:row.get(field) or '',reverse=descending)
            total=len(rows)
            if request.query_params.get('head')=='1':
                return Response({'data':None,'count':total})
            try:
                offset=max(0,int(request.query_params.get('offset','0')))
                limit=min(max(0,int(request.query_params.get('limit','100'))),500)
            except ValueError:
                return Response({'error':'offset and limit must be integers'},status=400)
            rows=rows[offset:offset+limit]
            if request.query_params.get('single')=='1':
                if not rows: return Response(None if request.query_params.get('maybe_single')=='1' else {'error':'Not found'},status=200 if request.query_params.get('maybe_single')=='1' else 404)
                return Response(rows[0])
            selected=parse_selected_fields(request.query_params.get('select',''))
            if selected and '*' not in selected:
                rows=[{field:row[field] for field in selected if '(' not in field and field in row} for row in rows]
            if request.query_params.get('count') in {'exact','planned','estimated','1','true'}:
                return Response({'data':rows,'count':total})
            return Response(rows)
        if request.method=='POST':
            data=request.data.copy()
            if resource=='salon_categories':
                salon_id=data.get('salon_id')
                category_id=data.get('category_id')
                if not salon_id or not category_id:
                    return Response({'error':'Salon and category are required.'},status=400)
                if not Salon.objects.filter(id=salon_id,owner=request.user).exists():
                    return Response({'error':'You may only manage categories for your own salon.'},status=403)
                existing=qs.filter(
                    owner=request.user,
                    data__salon_id=str(salon_id),
                    data__category_id=str(category_id),
                ).first()
                if existing:
                    return Response({'id':str(existing.id),**(existing.data or {})},status=200)
            conflict=request.query_params.get('on_conflict')
            if conflict:
                matches={field:data[field] for field in conflict.split(',') if field in data}
                if not matches:
                    return Response({'error':'on_conflict must match a provided field'},status=400)
                existing=next((obj for obj in qs.order_by('-created_at') if all((obj.data or {}).get(key)==value for key,value in matches.items())),None)
                if existing:
                    if request.query_params.get('ignore_duplicates')=='1':
                        return Response({'id':str(existing.id),**(existing.data or {})})
                    existing.data={**(existing.data or {}),**data}
                    existing.save(update_fields=['data','updated_at'])
                    return Response({'id':str(existing.id),**existing.data})
            obj=Model.objects.create(resource=resource,data=data,owner=request.user if request.user.is_authenticated else None); return Response({'id':str(obj.id),**data},status=201)
        if request.method=='DELETE' and resource=='salon_categories':
            salon_id=request.query_params.get('salon_id')
            category_id=request.query_params.get('category_id')
            if not salon_id or not category_id:
                return Response({'error':'Salon and category are required.'},status=400)
            if not Salon.objects.filter(id=salon_id,owner=request.user).exists():
                return Response({'error':'You may only manage categories for your own salon.'},status=403)
            deleted,_=qs.filter(
                owner=request.user,
                data__salon_id=str(salon_id),
                data__category_id=str(category_id),
            ).delete()
            return Response(status=204 if deleted else 404)
        obj_id=request.query_params.get('id') or request.data.get('id')
        obj=scoped_queryset(Model.objects.filter(resource=resource),resource,request.user).filter(id=obj_id).first()
        if not obj: return Response({'error':'Not found'},status=404)
        if request.method in {'PATCH','PUT'}:
            obj.data={**(obj.data or {}),**request.data}; obj.save(); return Response({'id':str(obj.id),**obj.data})
        obj.delete(); return Response(status=204)

    if resource in ADMIN_ONLY|SENSITIVE and not is_admin_user(request.user):
        if resource=='contact_messages' and request.method=='POST':
            pass
        elif request.method!='GET':
            return Response({'error':'Forbidden'},status=403)
        elif resource in SENSITIVE and not (
            request.method=='GET' and resource=='subscription_status_history'
        ):
            return Response({'error':'Forbidden'},status=403)
    qs=scoped_queryset(Model.objects.all(),resource,request.user)
    if request.method=='GET' and not request.user.is_authenticated:
        if resource=='salons':
            qs=qs.filter(status='approved',is_active=True)
        elif resource in {'services','hairstyles','hairstyle_catalog','wedding_packages'}:
            qs=qs.filter(is_active=True,salon__status='approved',salon__is_active=True)
        elif resource in {'subscription_plans','app_features','service_categories','locations'} and hasattr(Model,'is_active'):
            qs=qs.filter(is_active=True)
    if request.method=='GET':
        for k,v in request.query_params.items():
            if k in {'limit','offset','order','select','single','maybe_single','count','head','or'}: continue
            qs=apply_query_filter(qs,Model,k,v)
        or_expr=request.query_params.get('or')
        if or_expr:
            q_or=Q()
            for clause in parse_selected_fields(or_expr):
                try:
                    field,op,val=clause.split('.',2)
                except ValueError:
                    continue
                if op=='in' and val.startswith('(') and val.endswith(')'):
                    op='in'
                    val=val[1:-1]
                field_name=query_field_name(Model,field)
                if field_name:
                    if op=='ilike': q_or |= Q(**{field_name+'__icontains':val.strip('%')})
                    elif op=='eq': q_or |= Q(**{field_name:val})
                    elif op=='in' and val.startswith('(') and val.endswith(')'):
                        q_or |= Q(**{field_name+'__in':val[1:-1].split(',')})
                    elif op=='in': q_or |= Q(**{field_name+'__in':val.split(',')})
            if q_or.children: qs=qs.filter(q_or)

        order=request.query_params.get('order')
        if order:
            parts=order.split(',')
            valid=[]
            for part in parts:
                descending=part.startswith('-')
                field_name=query_field_name(Model,part.lstrip('-'))
                if field_name: valid.append(('-' if descending else '')+field_name)
            if valid: qs=qs.order_by(*valid)
        total=qs.count()
        include_count=request.query_params.get('count') in {'exact','planned','estimated','1','true'}
        if request.query_params.get('head')=='1':
            return Response({'data':None,'count':total})
        try:
            offset=max(0,int(request.query_params.get('offset','0')))
            limit=min(max(0,int(request.query_params.get('limit','100'))),500)
        except ValueError:
            return Response({'error':'offset and limit must be integers'},status=400)
        rows=list(qs[offset:offset+limit])
        if request.query_params.get('single')=='1':
            if not rows: return Response(None if request.query_params.get('maybe_single')=='1' else {'error':'Not found'},status=200 if request.query_params.get('maybe_single')=='1' else 404)
        serializer_class=PublicSalonSerializer if resource=='salons' and not request.user.is_authenticated else Ser
        selected=parse_selected_fields(request.query_params.get('select',''))
        if selected and '*' not in selected:
            serialized=serialize_selected_rows(rows,serializer_class,Model,selected)
        else:
            serialized=[add_foreign_key_ids(serializer_class(row).data.copy(),row) for row in rows]
        if request.query_params.get('single')=='1':
            return Response(serialized[0])
        if include_count: return Response({'data':serialized,'count':total})
        return Response(serialized)
    if request.method=='POST':
        if resource=='user_roles' and not is_admin_user(request.user):
            return Response({'error':'Forbidden'},status=403)
        if resource=='contact_messages' and request.query_params.get('on_conflict'):
            return Response({'error':'Contact messages cannot be upserted'},status=400)
        if resource=='bookings' and not is_admin_user(request.user):
            return Response({'error':'Create bookings through the validated booking endpoint'},status=403)
        data=request.data.copy()
        if resource=='support_tickets' and 'salon_id' in data and 'salon' not in data:
            data['salon']=data.pop('salon_id')
        if 'pin_code' in data and 'pincode' not in data: data['pincode']=data.pop('pin_code')
        if resource=='profiles': data['id']=request.user.id
        if resource in {'bookings'}: data['customer']=request.user.id
        if resource=='support_tickets': data['user']=request.user.id
        if resource=='contact_messages':
            data['user']=request.user.id if request.user.is_authenticated else None
            data['status']='new'
        if resource in {'salons'} and role(request.user) in {'owner','salon_owner'}: data['owner']=request.user.id
        if resource in {'services','hairstyles','hairstyle_catalog','wedding_packages','salon_resources','salon_closures','salon_hours','salon_blocks'} and not is_admin_user(request.user):
            salon_id=data.get('salon')
            if not salon_id or not Salon.objects.filter(id=salon_id,owner=request.user).exists():
                return Response({'error':'You may only add records to your own salon'},status=403)
        if resource in {'user_roles','payment_gateway_settings','subscription_plans','app_features','service_categories','locations'} and not is_admin_user(request.user):
            return Response({'error':'Forbidden'},status=403)
        conflict=request.query_params.get('on_conflict')
        if conflict:
            matches={}
            for name in conflict.split(','):
                field_name=query_field_name(Model,name)
                if field_name and field_name in data:
                    matches[field_name]=data[field_name]
                elif field_name and field_name.endswith('_id'):
                    public_name=field_name[:-3]
                    if public_name in data: matches[field_name]=data[public_name]
            if not matches:
                return Response({'error':'on_conflict must match a provided field'},status=400)
            existing=qs.filter(**matches).first()
            if existing:
                if request.query_params.get('ignore_duplicates')=='1':
                    return Response(Ser(existing).data)
                serializer=Ser(existing,data=data,partial=True)
                serializer.is_valid(raise_exception=True)
                obj=serializer.save()
                return Response(Ser(obj).data)
        s=Ser(data=data)
        s.is_valid(raise_exception=True)
        if resource=='reviews':
            booking=s.validated_data['booking']
            if booking.customer_id!=request.user.id:
                return Response({'error':'You may only review your own appointment.'},status=403)
            if booking.status!='completed':
                return Response({'error':'Only completed appointments can be reviewed.'},status=400)
            if Review.objects.filter(booking=booking).exists():
                return Response({'error':'This appointment has already been reviewed.'},status=400)
            obj=s.save(
                customer=request.user,
                salon=booking.salon,
                service=booking.service,
            )
        elif resource=='support_tickets':
            salon=s.validated_data.get('salon')
            if salon and not is_admin_user(request.user) and salon.owner_id!=request.user.id:
                return Response({'error':'You may only create support tickets for your own salon.'},status=403)
            obj=s.save(user=request.user)
        else:
            obj=s.save()
        return Response(Ser(obj).data,status=201)
    obj_id=request.query_params.get('id') or request.data.get('id')
    if not obj_id: return Response({'error':'id is required'},status=400)
    obj=scoped_queryset(Model.objects.all(),resource,request.user).filter(pk=obj_id).first()
    if not obj: return Response({'error':'Not found'},status=404)
    if resource=='user_roles' and not is_admin_user(request.user):
        return Response({'error':'Forbidden'},status=403)
    if resource=='salons' and not is_admin_user(request.user) and obj.owner_id != request.user.id:
        return Response({'error':'You may only update your own salon'},status=403)
    if resource=='bookings' and not is_admin_user(request.user):
        if obj.customer_id != request.user.id or request.data.get('status') != 'cancelled':
            return Response({'error':'Customers may only cancel their own bookings'},status=403)
        if set(request.data) - {'status','cancellation_reason'}:
            return Response({'error':'Customers may only update booking cancellation fields'},status=403)
    if request.method in {'PATCH','PUT'}:
        s=Ser(obj,data=request.data,partial=request.method=='PATCH'); s.is_valid(raise_exception=True); obj=s.save(); return Response(Ser(obj).data)
    obj.delete(); return Response(status=204)


@api_view(['POST'])
@permission_classes([AllowAny])
def demo_submit(request):
    data=request.data or {}
    required=['salonName','salonType','ownerName','phone','email','address','state','district','pinCode','openingTime','closingTime','password']
    missing=[x for x in required if not str(data.get(x,'')).strip()]
    if missing: return Response({'error':f"Required: {', '.join(missing)}"},status=400)
    registration=RegisterSerializer(data={
        'email':data['email'],
        'password':data['password'],
        'full_name':data['ownerName'],
        'phone':data['phone'],
        'role':'owner',
    })
    registration.is_valid(raise_exception=True)
    email=registration.validated_data['email']
    state=Location.objects.filter(level='state',is_active=True,name__iexact=str(data['state']).strip()).first()
    if not state: return Response({'error':'Please select a valid state.'},status=400)
    district=Location.objects.filter(level='district',is_active=True,parent=state,name__iexact=str(data['district']).strip()).first()
    if not district: return Response({'error':'Please select a district from the list.'},status=400)
    from django.utils.text import slugify
    with transaction.atomic():
        user=registration.save()
        profile=user.profile
        profile.email=email
        profile.city=str(data.get('city','')).strip()
        profile.save(update_fields=['email','city'])
        base_slug=slugify(str(data['salonName']))[:48] or 'salon'
        slug=f"{base_slug}-{str(user.id)}"
        salon=Salon.objects.create(
            owner=user,name=str(data['salonName']).strip(),slug=slug,salon_type=str(data['salonType']).strip(),
            phone=str(data['phone']).strip(),email=email,whatsapp_number=str(data.get('whatsapp') or ''),
            about=str(data.get('description') or ''),seats=data.get('seats'),years_in_business=data.get('yearsInBusiness'),
            address=str(data['address']).strip(),state=state.name,district=district.name,city=str(data.get('city') or district.name).strip(),
            area=str(data.get('area') or ''),pincode=str(data['pinCode']).strip(),latitude=data.get('latitude'),
            longitude=data.get('longitude'),website_url=str(data.get('websiteUrl') or data.get('mapsUrl') or ''),
            opening_time=data.get('openingTime'),closing_time=data.get('closingTime'),weekly_closed_day=data.get('weeklyClosedDay'),
            services_offered=[x.strip() for x in str(data.get('servicesOffered') or '').split(',') if x.strip()],
            starting_price=data.get('startingPrice') or 0,instagram_url=str(data.get('instagramUrl') or ''),
            facebook_url=str(data.get('facebookUrl') or ''),status='pending',is_active=False
        )
        DemoRequest.objects.create(owner_name=str(data['ownerName']).strip(),salon_name=str(data['salonName']).strip(),
            phone=str(data['phone']).strip(),email=email,city=salon.city,state=state.name,district=district.name,
            address=salon.address,branches=1,message=str(data.get('description') or ''),status='pending',created_salon=salon)
    refresh=RefreshToken.for_user(user)
    return Response({
        'salonId':str(salon.id),
        'user':UserSerializer(user).data,
        'access':str(refresh.access_token),
        'refresh':str(refresh),
    },status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rpc_dispatch(request, name):
    """REST compatibility layer for the former Supabase RPC contract."""
    a=request.data or {}
    user=request.user
    is_admin=user.is_staff or role(user)=='super_admin'

    if name == 'payment_gateway_test':
        if not is_admin: return Response({'error':'Forbidden'},status=403)
        provider=a.get('provider')
        if provider not in {'razorpay','phonepe'}:
            return Response({'error':'Unknown payment gateway'},status=400)
        # Provider credentials/payment calls are deliberately not wired yet.
        row=PaymentGatewaySettings.objects.filter(provider=provider).first()
        if row:
            row.connection_status='not_connected'
            row.connection_message='Payment gateway integration is not implemented in the Django backend yet.'
            row.last_verified_at=None
            row.save(update_fields=['connection_status','connection_message','last_verified_at','updated_at'])
        return Response({'ok':False,'implemented':False,'message':'Payment gateway integration is not implemented in the Django backend yet.'})

    if name == 'has_role':
        uid=a.get('_user_id') or str(user.id); wanted=a.get('_role')
        if str(uid) != str(user.id) and not is_admin: return Response(False)
        return Response(UserRole.objects.filter(user_id=uid, role=wanted).exists() or (wanted=='super_admin' and User.objects.filter(pk=uid,is_staff=True).exists()))

    if name == 'super_admin_count':
        return Response(UserRole.objects.filter(role='super_admin').count()+User.objects.filter(is_staff=True).exclude(id__in=UserRole.objects.filter(role='super_admin').values('user_id')).count())

    if name == 'claim_super_admin':
        if UserRole.objects.filter(role='super_admin').exists() or User.objects.filter(is_staff=True).exists():
            return Response(False)
        UserRole.objects.get_or_create(user=user,role='super_admin')
        p, _ = Profile.objects.get_or_create(id=user)
        p.role='super_admin'; p.save(update_fields=['role'])
        user.is_staff=True; user.save(update_fields=['is_staff'])
        return Response(True)

    if name == 'admin_set_user_role':
        if not is_admin: return Response({'error':'Forbidden'},status=403)
        uid=a.get('_user_id'); r=a.get('_role'); enabled=bool(a.get('_enabled',True))
        if not uid or not r: return Response({'error':'_user_id and _role are required'},status=400)
        if enabled: UserRole.objects.get_or_create(user_id=uid,role=r)
        else: UserRole.objects.filter(user_id=uid,role=r).delete()
        if r in {'super_admin','salon_owner'}:
            p,_=Profile.objects.get_or_create(id=uid)
            p.role=r if enabled else ('customer' if r==p.role else p.role); p.save(update_fields=['role'])
        return Response(True)

    if name == 'admin_remove_super_admin':
        if not is_admin: return Response({'error':'Forbidden'},status=403)
        uid=a.get('_user_id')
        if str(uid)==str(user.id): return Response({'error':'You cannot remove your own Super Admin role.'},status=400)
        UserRole.objects.filter(user_id=uid,role='super_admin').delete()
        return Response(True)

    if name == 'admin_set_salon_status':
        if not is_admin: return Response({'error':'Forbidden'},status=403)
        with transaction.atomic():
            salon=Salon.objects.select_for_update().filter(id=a.get('_salon_id')).first()
            if not salon: return Response({'error':'Salon not found'},status=404)
            salon.status=a.get('_status','pending')
            salon.is_active=salon.status=='approved'
            now=timezone.now()
            if salon.status=='approved':
                first_approval=salon.approved_at is None
                salon.approved_at=salon.approved_at or now
                sub=SalonSubscription.objects.select_for_update().filter(salon=salon).first()
                if sub:
                    Subscription.objects.update_or_create(
                        salon=salon,
                        defaults={'plan':sub.plan,'start_at':sub.started_at,'end_at':sub.expires_at,'status':sub.status}
                    )
                else:
                    legacy=Subscription.objects.select_for_update().filter(salon=salon).first()
                    if legacy:
                        legacy_status={
                            'trial':'trialing',
                            'trialing':'trialing',
                            'active':'active',
                            'expired':'expired',
                            'cancelled':'cancelled',
                            'suspended':'suspended',
                        }.get(legacy.status)
                        if not legacy_status:
                            return Response({'error':'Existing subscription has an unsupported status; resolve it before approving this salon.'},status=400)
                        sub=SalonSubscription.objects.create(
                            salon=salon,
                            owner=salon.owner,
                            plan=legacy.plan,
                            status=legacy_status,
                            started_at=legacy.start_at,
                            expires_at=legacy.end_at,
                            trial_start_date=legacy.start_at if legacy_status=='trialing' else None,
                            trial_end_date=legacy.end_at if legacy_status=='trialing' else None,
                        )
                    else:
                        plan=SubscriptionPlan.objects.filter(is_active=True).first()
                        if not plan:
                            return Response({'error':'No active subscription plan is configured.'},status=400)
                        trial_enabled=first_approval and plan.trial_enabled and plan.trial_days>0
                        expiry=now+datetime_timedelta(days=plan.trial_days) if trial_enabled else now
                        sub=SalonSubscription.objects.create(
                            salon=salon,
                            owner=salon.owner,
                            plan=plan,
                            status='trialing' if trial_enabled else 'expired',
                            started_at=now,
                            expires_at=expiry,
                            trial_start_date=now if trial_enabled else None,
                            trial_end_date=expiry if trial_enabled else None,
                        )
                    Subscription.objects.update_or_create(
                        salon=salon,
                        defaults={'plan':sub.plan,'start_at':sub.started_at,'end_at':sub.expires_at,'status':sub.status}
                    )
                    SubscriptionStatusHistory.objects.create(
                        salon=salon,
                        status=sub.status,
                        note='Subscription initialized or migrated on salon approval',
                    )
            salon.save(update_fields=['status','is_active','approved_at','updated_at'])
            return Response(True)

    if name == 'owner_resubmit_salon':
        salon=Salon.objects.filter(id=a.get('_salon_id'),owner=user).first()
        if not salon: return Response({'error':'Salon not found'},status=404)
        salon.status='pending'; salon.is_active=False; salon.save(update_fields=['status','is_active','updated_at'])
        return Response(True)

    if name == 'salon_customer_profiles':
        salon=Salon.objects.filter(owner=user).first()
        if not salon: return Response([])
        ids=Booking.objects.filter(salon=salon).values_list('customer_id',flat=True).distinct()
        return Response([{'id':u.id,'full_name':getattr(getattr(u,'profile',None),'full_name',''),'phone':getattr(getattr(u,'profile',None),'phone','')} for u in User.objects.filter(id__in=ids)])

    if name in {'owner_set_booking_status','owner_reschedule_booking','owner_mark_booking_paid'}:
        b=Booking.objects.select_for_update().filter(id=a.get('_booking_id')).first()
        if not b: return Response({'error':'Booking not found'},status=404)
        if not is_admin and b.salon.owner_id != user.id: return Response({'error':'Forbidden'},status=403)
        if name=='owner_set_booking_status':
            b.status=a.get('_status',b.status)
            if a.get('_note'): b.notes=a['_note']
            b.save()
            return Response(True)
        if name=='owner_reschedule_booking':
            new_date=a.get('_booking_date'); new_time=a.get('_slot_time')
            if not new_date or not new_time: return Response({'error':'date and time are required'},status=400)
            from datetime import datetime,timedelta
            end=(datetime.combine(datetime.fromisoformat(str(new_date)),datetime.strptime(str(new_time)[:5],'%H:%M').time())+timedelta(minutes=b.duration_minutes)).time()
            conflict=Booking.objects.filter(salon=b.salon,date=new_date,status__in=['pending','confirmed']).exclude(id=b.id).filter(start_time__lt=end,end_time__gt=new_time).exists()
            if conflict: return Response({'error':'Selected time is no longer available'},status=409)
            b.date=new_date; b.start_time=new_time; b.end_time=end; b.save()
            return Response(True)
        method=a.get('_method','cash')
        Payment.objects.update_or_create(booking=b,defaults={'salon':b.salon,'customer':b.customer,'amount':b.amount,'method':method,'status':'paid','paid_at':timezone.now(),'confirmed_by':user,'confirmed_at':timezone.now(),'note':a.get('_note','')})
        return Response(True)

    if name == 'salon_open_now':
        salon=Salon.objects.filter(id=a.get('_salon_id')).first()
        if not salon: return Response(False)
        now=timezone.localtime(); closed=False
        if SalonClosure.objects.filter(salon=salon,closed_date=now.date()).exists(): closed=True
        if salon.opening_time and salon.closing_time:
            t=now.time()
            closed = closed or not (salon.opening_time <= t < salon.closing_time)
        if salon.weekly_closed_day is not None and now.weekday()==salon.weekly_closed_day: closed=True
        return Response(not closed and salon.is_active)

    if name == 'salons_nearby':
        from math import radians,sin,cos,asin,sqrt
        lat=float(a.get('_lat',0)); lng=float(a.get('_lng',0)); limit=min(int(a.get('_limit',200)),500)
        rows=[]
        for salon in Salon.objects.filter(status='approved',is_active=True):
            if salon.latitude is None or salon.longitude is None: continue
            dlat=radians(float(salon.latitude)-lat); dlng=radians(float(salon.longitude)-lng)
            x=sin(dlat/2)**2+cos(radians(lat))*cos(radians(float(salon.latitude)))*sin(dlng/2)**2
            dist=6371*2*asin(sqrt(x)); rows.append({'salon_id':str(salon.id),'distance_km':round(dist,3)})
        rows.sort(key=lambda x:x['distance_km']); return Response(rows[:limit])

    if name == 'salon_available_slots':
        from datetime import datetime,timedelta
        salon=Salon.objects.filter(id=a.get('_salon_id')).first()
        if not salon: return Response([])
        date=a.get('_date'); duration=int(a.get('_duration_min',30)); interval=max(1,int(salon.booking_interval_min or 10))
        if SalonClosure.objects.filter(salon=salon,closed_date=date).exists(): return Response([])
        if salon.weekly_closed_day is not None:
            dt=datetime.fromisoformat(str(date)).date()
            if dt.weekday()==salon.weekly_closed_day: return Response([])
        opening=salon.opening_time or datetime.strptime('09:00','%H:%M').time()
        closing=salon.closing_time or datetime.strptime('20:00','%H:%M').time()
        resources=list(SalonResource.objects.filter(salon=salon,is_active=True).order_by('sort_order','id'))
        capacity=len(resources) or max(int(salon.seats or 1),1)
        out=[]; cur=datetime.combine(datetime.fromisoformat(str(date)).date(),opening); close_dt=datetime.combine(datetime.fromisoformat(str(date)).date(),closing)
        now=timezone.localtime()
        while cur+timedelta(minutes=duration) <= close_dt:
            if cur.date()==now.date() and cur < now.replace(tzinfo=None): cur += timedelta(minutes=interval); continue
            end=cur+timedelta(minutes=duration)
            blocked=SalonBlock.objects.filter(salon=salon,block_date=date,start_time__lt=end.time(),end_time__gt=cur.time()).exists()
            count=Booking.objects.filter(salon=salon,date=date,status__in=['pending','confirmed'],start_time__lt=end.time(),end_time__gt=cur.time()).count()
            if not blocked and count < capacity: out.append({'slot':cur.strftime('%H:%M')})
            cur += timedelta(minutes=interval)
        return Response(out)

    if name == 'create_booking':
        salon=Salon.objects.filter(id=a.get('_salon_id'),status='approved',is_active=True).first()
        if not salon: return Response({'error':'Salon is not available'},status=400)
        service=Service.objects.filter(id=a.get('_service_id')).first() if a.get('_service_id') else None
        hairstyle=Hairstyle.objects.filter(id=a.get('_hairstyle_id')).first() if a.get('_hairstyle_id') else None
        package=WeddingPackage.objects.filter(id=a.get('_package_id')).first() if a.get('_package_id') else None
        item=service or hairstyle or package
        if not item: return Response({'error':'A service, hairstyle or package is required'},status=400)
        duration=int(getattr(item,'duration_minutes',30)); start=str(a.get('_slot_time',''))[:5]
        from datetime import datetime,timedelta
        start_dt=datetime.strptime(start,'%H:%M'); end_dt=start_dt+timedelta(minutes=duration)
        with transaction.atomic():
            capacity=max(SalonResource.objects.filter(salon=salon,is_active=True).count(),int(salon.seats or 1),1)
            overlaps=list(Booking.objects.select_for_update().filter(
                salon=salon,date=a.get('_booking_date'),status__in=['pending','confirmed'],
                start_time__lt=end_dt.time(),end_time__gt=start_dt.time()
            ).values_list('chair_number',flat=True))
            used={int(x) for x in overlaps if x is not None}
            chair=next((n for n in range(1,capacity+1) if n not in used),None)
            if chair is None:
                return Response({'error':'Selected time is no longer available'},status=409)
            b=Booking.objects.create(
                salon=salon,customer=user,service=service,hairstyle=hairstyle,wedding_package=package,
                date=a.get('_booking_date'),start_time=start_dt.time(),end_time=end_dt.time(),
                duration_minutes=duration,chair_number=chair,amount=getattr(item,'price',0),notes=a.get('_notes','')
            )
        return Response(str(b.id))

    if name in {'loyalty_rule_for','owner_loyalty_rule'}:
        r=LoyaltyRule.objects.filter(salon_id=a.get('_salon_id')).first()
        return Response(LoyaltyRuleSerializer(r).data if r else None)

    if name == 'owner_save_loyalty_rule':
        salon=Salon.objects.filter(id=a.get('_salon_id'),owner=user).first()
        if not salon and not is_admin: return Response({'error':'Forbidden'},status=403)
        r,_=LoyaltyRule.objects.get_or_create(salon_id=a.get('_salon_id'))
        for src,dst in [('_points_per_hundred','points_per_hundred'),('_point_value_rupees','point_value_rupees'),('_min_redeem_points','min_redeem_points'),('_max_redeem_percent','max_redeem_percent'),('_is_active','is_active')]:
            if src in a: setattr(r,dst,a[src])
        r.save(); return Response(LoyaltyRuleSerializer(r).data)

    if name == 'redeem_loyalty_points':
        salon=Salon.objects.filter(id=a.get('_salon_id')).first()
        points=int(a.get('_points',0))
        if not salon or points<=0: return Response({'error':'Invalid redemption'},status=400)
        with transaction.atomic():
            acct=LoyaltyAccount.objects.select_for_update().filter(customer=user,salon=salon).first()
            if not acct or acct.balance<points: return Response({'error':'Insufficient loyalty points'},status=400)
            acct.balance-=points; acct.total_redeemed+=points; acct.save()
            LoyaltyTransaction.objects.create(customer=user,salon=salon,booking_id=a.get('_booking_id'),points=-points,kind='redeem',reason='Booking redemption')
        return Response(points)

    if name == 'admin_manage_subscription':
        if not is_admin: return Response({'error':'Forbidden'},status=403)
        action=a.get('_action')
        allowed_actions={'activate','renew','extend','extend_trial','end_trial','cancel','suspend','reactivate'}
        if not isinstance(action,str) or action not in allowed_actions:
            return Response({'error':'Unsupported subscription action.'},status=400)
        try:
            raw_days=a.get('_days',30)
            if isinstance(raw_days,bool): raise ValueError
            if isinstance(raw_days,float) and not raw_days.is_integer(): raise ValueError
            days=int(raw_days)
        except (TypeError,ValueError):
            return Response({'error':'Subscription days must be a whole number between 1 and 3650.'},status=400)
        if days<1 or days>3650:
            return Response({'error':'Subscription days must be a whole number between 1 and 3650.'},status=400)

        with transaction.atomic():
            salon=Salon.objects.select_for_update().filter(id=a.get('_salon_id')).first()
            if not salon: return Response({'error':'Salon not found'},status=404)
            plan=SubscriptionPlan.objects.filter(is_active=True).first()
            if not plan: return Response({'error':'No active subscription plan is configured.'},status=400)
            now=timezone.now()
            sub,_=SalonSubscription.objects.get_or_create(
                salon=salon,
                defaults={'owner':salon.owner,'plan':plan,'started_at':now,'expires_at':now,'status':'trialing'}
            )
            if action in {'activate','renew','extend','extend_trial','reactivate'}:
                start=max(sub.expires_at,now)
                sub.started_at=start
                sub.expires_at=start+datetime_timedelta(days=days)
                sub.status='trialing' if action=='extend_trial' else 'active'
                if action=='extend_trial':
                    sub.trial_start_date=sub.trial_start_date or now
                    sub.trial_end_date=sub.expires_at
                sub.cancelled_at=None
                sub.suspended_at=None
            elif action=='end_trial':
                sub.expires_at=now
                sub.status='expired'
            elif action=='cancel':
                sub.status='cancelled'
                sub.cancelled_at=now
            elif action=='suspend':
                sub.status='suspended'
                sub.suspended_at=now
            sub.plan=plan
            sub.owner=salon.owner
            sub.save()
            Subscription.objects.update_or_create(
                salon=salon,
                defaults={'plan':plan,'start_at':sub.started_at,'end_at':sub.expires_at,'status':sub.status}
            )
            note=str(a.get('_note') or '').strip()[:500] or action.replace('_',' ')
            SubscriptionStatusHistory.objects.create(salon=salon,status=sub.status,note=note)
            return Response(SalonSubscriptionSerializer(sub).data)

    if name == 'salon_subscription_states_for':
        salon_ids=a.get('_salon_ids') or a.get('salon_ids') or []
        qs=Subscription.objects.filter(salon_id__in=salon_ids) if salon_ids else Subscription.objects.none()
        return Response([{'salon_id':str(x.salon_id),'status':x.status,'start_at':x.start_at,'end_at':x.end_at} for x in qs])

    if name == 'hairstyle_trending':
        return Response([])

    return Response({'error':f'Unknown RPC: {name}'},status=404)


@api_view(['GET'])
@permission_classes([AllowAny])
def salons_nearby(request):
    from math import asin, cos, isfinite, radians, sin, sqrt

    try:
        latitude=float(request.query_params.get('lat',''))
        longitude=float(request.query_params.get('lng',''))
        limit=int(request.query_params.get('limit','200'))
    except (TypeError,ValueError):
        return Response({'error':'Valid latitude and longitude are required.'},status=400)
    if (
        not isfinite(latitude) or not isfinite(longitude)
        or not -90<=latitude<=90 or not -180<=longitude<=180
    ):
        return Response({'error':'Latitude or longitude is out of range.'},status=400)
    if not 1<=limit<=500:
        return Response({'error':'Limit must be between 1 and 500.'},status=400)

    rows=[]
    salons=Salon.objects.filter(
        status='approved',
        is_active=True,
        latitude__isnull=False,
        longitude__isnull=False,
    ).only('id','latitude','longitude')
    for salon in salons.iterator():
        salon_latitude=float(salon.latitude)
        salon_longitude=float(salon.longitude)
        dlat=radians(salon_latitude-latitude)
        dlng=radians(salon_longitude-longitude)
        haversine=(
            sin(dlat/2)**2
            + cos(radians(latitude))*cos(radians(salon_latitude))*sin(dlng/2)**2
        )
        distance=6371*2*asin(sqrt(min(1.0,max(0.0,haversine))))
        rows.append({'salon_id':str(salon.id),'distance_km':round(distance,3)})
    rows.sort(key=lambda row:row['distance_km'])
    return Response(rows[:limit])

@api_view(['GET'])
@permission_classes([AllowAny])
def reverse_geocode(request):
    """Resolve coordinates using the deployment's configured private geocoder."""
    from math import isfinite

    try:
        latitude = float(request.query_params.get('lat', ''))
        longitude = float(request.query_params.get('lng', ''))
    except (TypeError, ValueError):
        return Response({'error':'Valid latitude and longitude are required.'},status=400)
    if (
        not isfinite(latitude) or not isfinite(longitude)
        or not -90 <= latitude <= 90 or not -180 <= longitude <= 180
    ):
        return Response({'error':'Latitude or longitude is out of range.'},status=400)

    geocoder_url = settings.REVERSE_GEOCODER_URL
    if not geocoder_url:
        return Response(
            {'error':'Reverse geocoding is not configured. Enter the address manually.'},
            status=503,
        )

    query = urlencode({
        'lat':latitude,
        'lon':longitude,
        'format':'jsonv2',
        'addressdetails':1,
    })
    separator = '&' if '?' in geocoder_url else '?'
    upstream_request = Request(
        f'{geocoder_url}{separator}{query}',
        headers={'Accept':'application/json','User-Agent':'SalonX/1.0'},
    )
    try:
        with urlopen(upstream_request, timeout=5) as response:
            result = json.loads(response.read())
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
        return Response(
            {'error':'The configured reverse-geocoding service could not resolve this location.'},
            status=502,
        )

    if not isinstance(result, dict) or not isinstance(result.get('address'), dict):
        return Response({'error':'No address details were found for this location.'},status=404)

    address_parts = result['address']
    area_names = (
        address_parts.get('neighbourhood'),
        address_parts.get('suburb'),
        address_parts.get('quarter'),
        address_parts.get('residential'),
        address_parts.get('village'),
        address_parts.get('hamlet'),
    )
    state_name = address_parts.get('state')
    district_name = (
        address_parts.get('state_district')
        or address_parts.get('district')
        or address_parts.get('county')
    )
    state = Location.objects.filter(
        level='state', is_active=True, name__iexact=state_name or '',
    ).first()
    district = Location.objects.filter(
        level='district', is_active=True, parent=state,
        name__iexact=district_name or '',
    ).first() if state else None

    return Response({
        'address':str(result.get('display_name') or '').strip(),
        'area':next((str(value).strip() for value in area_names if value), ''),
        'district':district.name if district else '',
        'state':state.name if state else '',
        'pinCode':str(address_parts.get('postcode') or '').strip(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def booking_create(request):
    with transaction.atomic():
        data=request.data.copy(); data['customer']=request.user.id
        salon_id=data.get('salon'); date=data.get('date'); start=data.get('start_time'); end=data.get('end_time')
        if not all([salon_id,date,start,end]): return Response({'error':'salon,date,start_time,end_time are required'},status=400)
        conflict=Booking.objects.select_for_update().filter(salon_id=salon_id,date=date,status__in=['pending','confirmed'],start_time__lt=end,end_time__gt=start).exists()
        if conflict: return Response({'error':'Selected time is no longer available'},status=409)
        s=BookingSerializer(data=data); s.is_valid(raise_exception=True); booking=s.save(); return Response(BookingSerializer(booking).data,status=201)


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_action(request, action):
    return Response(
        {
            'ok':True,'action':action,'note':'Use dedicated admin serializers/actions for production changes.'
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def media_upload(request):
    f=request.FILES.get('file')
    if not f: return Response({'error':'file is required'},status=400)
    from django.core.files.storage import default_storage
    import uuid
    name=f'uploads/{request.user.id}/{uuid.uuid4()}_{f.name}'
    path=default_storage.save(name,f)
    return Response({'path':path,'url':request.build_absolute_uri('/media/'+path)})

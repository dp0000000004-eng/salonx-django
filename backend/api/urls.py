from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import register,login,me,password_change,password_reset_request,db_resource,booking_create,admin_action,media_upload,rpc_dispatch,demo_submit,admin_status,salons_nearby,reverse_geocode
urlpatterns=[
 path('auth/register/',register),path('auth/login/',login),path('auth/me/',me),path('auth/password/',password_change),path('auth/password-reset/',password_reset_request),path('auth/refresh/',TokenRefreshView.as_view()),
 path('admin/status/',admin_status),
 path('salons/nearby/',salons_nearby),
 path('locations/reverse-geocode/',reverse_geocode),
 path('db/<str:resource>/',db_resource),path('rpc/<str:name>/',rpc_dispatch),path('demo/submit/',demo_submit),path('bookings/create/',booking_create),path('admin-action/<str:action>/',admin_action),path('media/upload/',media_upload),
]

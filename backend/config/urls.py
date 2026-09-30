from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from api.views import health

urlpatterns=[path('admin/',admin.site.urls),path('api/',include('api.urls')),path('health/',health)]
if settings.DEBUG: urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

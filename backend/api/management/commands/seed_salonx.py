from django.core.management.base import BaseCommand
from api.models import ServiceCategory,SubscriptionPlan,Location
from datetime import datetime
class Command(BaseCommand):
    def handle(self,*args,**kwargs):
        for name in ['Haircut','Hair Spa','Hair Color','Facial','Beard','Styling']:
            ServiceCategory.objects.get_or_create(name=name)
        SubscriptionPlan.objects.get_or_create(name='ALL-IN-ONE UNLIMITED',defaults={'trial_days':14,'price':0})
        state,_=Location.objects.get_or_create(name='Odisha',level='state',code='OD')
        districts=['Angul','Balangir','Balasore','Bargarh','Bhadrak','Boudh','Cuttack','Deogarh','Dhenkanal','Gajapati','Ganjam','Jagatsinghpur','Jajpur','Jharsuguda','Kalahandi','Kandhamal','Kendrapara','Keonjhar','Khordha','Koraput','Malkangiri','Mayurbhanj','Nabarangpur','Nayagarh','Nuapada','Puri','Rayagada','Sambalpur','Subarnapur','Sundargarh']
        for d in districts: Location.objects.get_or_create(name=d,level='district',parent=state)
        self.stdout.write(self.style.SUCCESS('SalonX seed data created.'))

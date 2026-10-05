import json
from django.core.management.base import BaseCommand
from api.models import ServiceCategory,SubscriptionPlan,Location
from datetime import datetime
from pathlib import Path
class Command(BaseCommand):
    def handle(self,*args,**kwargs):
        for name in ['Haircut','Hair Spa','Hair Color','Facial','Beard','Styling']:
            ServiceCategory.objects.get_or_create(name=name)
        SubscriptionPlan.objects.get_or_create(name='ALL-IN-ONE UNLIMITED',defaults={'trial_days':14,'price':0})
        dataset=Path(__file__).resolve().parents[2]/'data'/'india_states_districts.json'
        with dataset.open(encoding='utf-8') as source:
            for entry in json.load(source):
                state,_=Location.objects.get_or_create(
                    name=entry['state'],level='state',
                )
                for district in entry['districts']:
                    Location.objects.get_or_create(
                        name=district,level='district',parent=state,
                    )
        self.stdout.write(self.style.SUCCESS('SalonX seed data created.'))

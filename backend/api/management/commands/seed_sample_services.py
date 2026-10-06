from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Salon, Service, ServiceCategory


SAMPLE_SERVICES = [
    {
        'name':'Basic Haircut',
        'category':'Haircut',
        'description':'Sample service and price for MVP demonstration. Confirm actual salon pricing before launch.',
        'price':'199.00',
        'duration_minutes':30,
    },
    {
        'name':'Hair Wash & Blow Dry',
        'category':'Styling',
        'description':'Sample service and price for MVP demonstration. Confirm actual salon pricing before launch.',
        'price':'249.00',
        'duration_minutes':45,
    },
    {
        'name':'Hair Spa Treatment',
        'category':'Hair Spa',
        'description':'Sample service and price for MVP demonstration. Confirm actual salon pricing before launch.',
        'price':'699.00',
        'duration_minutes':60,
    },
    {
        'name':'Global Hair Color',
        'category':'Hair Color',
        'description':'Sample service and price for MVP demonstration. Confirm actual salon pricing before launch.',
        'price':'999.00',
        'duration_minutes':90,
    },
    {
        'name':'Express Facial',
        'category':'Facial',
        'description':'Sample service and price for MVP demonstration. Confirm actual salon pricing before launch.',
        'price':'599.00',
        'duration_minutes':45,
    },
    {
        'name':'Beard Trim',
        'category':'Beard',
        'description':'Sample service and price for MVP demonstration. Confirm actual salon pricing before launch.',
        'price':'149.00',
        'duration_minutes':20,
    },
]


class Command(BaseCommand):
    help = 'Add clearly labelled sample service listings to approved active salons.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        categories = {
            name: ServiceCategory.objects.get_or_create(name=name)[0]
            for name in {item['category'] for item in SAMPLE_SERVICES}
        }
        salons = Salon.objects.filter(status='approved', is_active=True).order_by('id')
        created_count = 0

        for salon in salons:
            for item in SAMPLE_SERVICES:
                _, created = Service.objects.get_or_create(
                    salon=salon,
                    name=item['name'],
                    defaults={
                        'category':categories[item['category']],
                        'description':item['description'],
                        'price':item['price'],
                        'duration_minutes':item['duration_minutes'],
                    },
                )
                created_count += int(created)

        self.stdout.write(
            self.style.SUCCESS(
                f'Added {created_count} sample services across {salons.count()} approved salons.'
            )
        )

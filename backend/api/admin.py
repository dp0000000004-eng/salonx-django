from django.contrib import admin
from .models import *
for m in [Profile,UserRole,Salon,ServiceCategory,Service,Hairstyle,WeddingPackage,Booking,Payment,LoyaltyRule,LoyaltyAccount,Notification,ContactMessage,SupportTicket,SubscriptionPlan,Subscription,Location]: admin.site.register(m)

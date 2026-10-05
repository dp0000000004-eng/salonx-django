from rest_framework.throttling import UserRateThrottle


class CostumThrottle(UserRateThrottle):
    scope = "hundred"
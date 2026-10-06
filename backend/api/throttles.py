from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


class CostumThrottle(UserRateThrottle):
    scope = "hundred"


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'

class SupportContactThrottle(UserRateThrottle):
    scope = 'support_contact'

class ApiResourceThrottle(UserRateThrottle):
    scope = 'api_resource'
from rest_framework.permissions import BasePermission, SAFE_METHODS

def role(user):
    return getattr(getattr(user,'profile',None),'role',None)
class IsAdmin(BasePermission):
    def has_permission(self, request, view): return request.user.is_authenticated and (request.user.is_staff or role(request.user)=='super_admin')
class IsOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view): return request.user.is_authenticated
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS: return True
        if request.user.is_staff or role(request.user)=='super_admin': return True
        owner_id=getattr(getattr(obj,'salon',None),'owner_id',None) or getattr(obj,'owner_id',None)
        return owner_id == request.user.id

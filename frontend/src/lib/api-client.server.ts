// Server-function compatibility boundary. Secrets must stay in the Django backend;
// this module intentionally does not contain database credentials.
export const apiServerUnavailable={
  from(){throw new Error('Use Django REST endpoints from the backend.');},
  rpc(){throw new Error('Use Django REST endpoints from the backend.');},
};
export const djangoAdmin:any=apiServerUnavailable;

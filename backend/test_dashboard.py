import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.views import DashboardView
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth.models import User

factory = APIRequestFactory()
request = factory.get('/api/dashboard/?period=week')
request.user = User.objects.get(username='admin')
force_authenticate(request, user=request.user)
view = DashboardView.as_view()

try:
    response = view(request)
    print('Status:', response.status_code)
except Exception as e:
    import traceback
    traceback.print_exc()

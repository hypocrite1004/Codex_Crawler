import urllib.request
import json
import traceback

try:
    # 1. Login
    req1 = urllib.request.Request(
        'http://127.0.0.1:8000/api/token/',
        data=json.dumps({'username':'admin', 'password':'admin123'}).encode(),
        headers={'Content-Type':'application/json'}
    )
    res1 = urllib.request.urlopen(req1)
    token = json.loads(res1.read())['access']
    print('Token obtained')

    # 2. Get Dashboard
    req2 = urllib.request.Request(
        'http://127.0.0.1:8000/api/dashboard/?period=week',
        headers={'Authorization': 'Bearer ' + token}
    )
    res2 = urllib.request.urlopen(req2)
    print('Status:', res2.status)
    print(res2.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP Error:', e.code)
    try:
        print(e.read().decode())
    except:
        pass
except Exception as e:
    traceback.print_exc()

import ipaddress
import socket
from functools import lru_cache
from urllib.parse import urlparse


BLOCKED_HEADER_NAMES = {
    'authorization',
    'cookie',
    'host',
}

BLOCKED_HEADER_PREFIXES = (
    'proxy-',
    'x-forwarded-',
)


class CrawlerSecurityError(Exception):
    def __init__(self, detail: dict[str, list[str]]):
        self.detail = detail
        super().__init__('Crawler request configuration is not allowed.')


def _config_value(config, key: str, default=None):
    if isinstance(config, dict):
        return config.get(key, default)
    return getattr(config, key, default)


def _raise(field: str, message: str):
    raise CrawlerSecurityError({field: [message]})


@lru_cache(maxsize=256)
def _resolve_hostname(hostname: str) -> tuple[str, ...]:
    try:
        infos = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise CrawlerSecurityError({'url': [f'URL host could not be resolved: {hostname}.']}) from exc

    addresses = []
    for info in infos:
        ip_value = info[4][0]
        if ip_value not in addresses:
            addresses.append(ip_value)
    return tuple(addresses)


def _validate_ip_address(ip_value: str):
    try:
        address = ipaddress.ip_address(ip_value)
    except ValueError as exc:
        raise CrawlerSecurityError({'url': [f'Invalid IP address: {ip_value}.']}) from exc

    if not address.is_global:
        raise CrawlerSecurityError({'url': [f'Non-public network targets are not allowed: {ip_value}.']})


def _validate_url(url: str, *, resolve_dns: bool):
    raw = (url or '').strip()
    if not raw:
        _raise('url', 'URL is required.')

    parsed = urlparse(raw)
    if parsed.scheme not in {'http', 'https'}:
        _raise('url', 'Only http and https URLs are allowed.')
    if not parsed.netloc or not parsed.hostname:
        _raise('url', 'URL must include a valid host.')

    hostname = parsed.hostname.strip().lower()
    if hostname == 'localhost':
        _raise('url', 'Localhost targets are not allowed.')

    try:
        _validate_ip_address(hostname)
        return
    except CrawlerSecurityError:
        try:
            ipaddress.ip_address(hostname)
        except ValueError:
            pass
        else:
            raise

    if resolve_dns:
        resolved_ips = _resolve_hostname(hostname)
        for ip_value in resolved_ips:
            _validate_ip_address(ip_value)


def _validate_headers(headers):
    if headers in (None, ''):
        return
    if not isinstance(headers, dict):
        _raise('request_headers', 'Request headers must be a JSON object.')

    for raw_name, raw_value in headers.items():
        if not isinstance(raw_name, str) or not raw_name.strip():
            _raise('request_headers', 'Header names must be non-empty strings.')
        if not isinstance(raw_value, str):
            _raise('request_headers', 'Header values must be strings.')

        normalized_name = raw_name.strip().lower()
        if normalized_name in BLOCKED_HEADER_NAMES or normalized_name.startswith(BLOCKED_HEADER_PREFIXES):
            _raise('request_headers', f'Header is not allowed: {raw_name}.')


def validate_crawler_request_config(config, *, resolve_dns: bool = True):
    _validate_url(_config_value(config, 'url', ''), resolve_dns=resolve_dns)
    _validate_headers(_config_value(config, 'request_headers', {}))


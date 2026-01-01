#!/bin/bash
set -e

# Default values
DOMAIN=""
IPV4=""
IPV6=""
EMAIL=""
SECRET=""

# Usage function
usage() {
    echo "Usage: $0 -d DOMAIN -4 IPV4 -6 IPV6 -e EMAIL -s SECRET"
    echo "  -d DOMAIN   Domain name for the TURN server (e.g., turn.example.com)"
    echo "  -4 IPV4     Public IPv4 address"
    echo "  -6 IPV6     Public IPv6 address"
    echo "  -e EMAIL    Email for Let's Encrypt registration"
    echo "  -s SECRET   TURN static auth secret"
    exit 1
}

# Parse arguments
while getopts "d:4:6:e:s:" opt; do
    case "$opt" in
        d) DOMAIN=$OPTARG ;;
        4) IPV4=$OPTARG ;;
        6) IPV6=$OPTARG ;;
        e) EMAIL=$OPTARG ;;
        s) SECRET=$OPTARG ;;
        *) usage ;;
    esac
done

# Validate inputs
if [ -z "$DOMAIN" ] || [ -z "$IPV4" ] || [ -z "$IPV6" ] || [ -z "$EMAIL" ] || [ -z "$SECRET" ]; then
    echo "Error: All arguments are required."
    usage
fi

echo "Deploying TURN server for $DOMAIN..."
echo "IPv4: $IPV4"
echo "IPv6: $IPV6"

# 1. Update and Install Dependencies
echo ">>> Updating system and installing dependencies..."
apt-get update
apt-get install -y coturn certbot

# 2. Obtain Certificate
echo ">>> Obtaining SSL certificate..."
# Stop coturn if running to free up port 80/443 for standalone certbot
systemctl stop coturn || true
certbot certonly --standalone --preferred-challenges http -d "$DOMAIN" -m "$EMAIL" --agree-tos -n

LE_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
LE_KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

if [ ! -f "$LE_CERT_PATH" ]; then
    echo "Error: Certificate generation failed."
    exit 1
fi

echo ">>> Setting up certificates for Coturn..."
mkdir -p /etc/coturn/certs
cp "$LE_CERT_PATH" /etc/coturn/certs/turn_server_cert.pem
cp "$LE_KEY_PATH" /etc/coturn/certs/turn_server_pkey.pem
chown -R turnserver:turnserver /etc/coturn/certs
chmod 644 /etc/coturn/certs/turn_server_cert.pem
chmod 600 /etc/coturn/certs/turn_server_pkey.pem

CERT_PATH="/etc/coturn/certs/turn_server_cert.pem"
KEY_PATH="/etc/coturn/certs/turn_server_pkey.pem"

# 3. Configure Coturn
echo ">>> Configuring Coturn..."
mv /etc/turnserver.conf /etc/turnserver.conf.bak || true

cat > /etc/turnserver.conf <<EOF
# Coturn Configuration

# Listener port for UDP and TCP
listening-port=3478
tls-listening-port=443

# Cipher list (Modern)
cipher-list=TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256

# Realm and Auth
realm=$DOMAIN
use-auth-secret
static-auth-secret=$SECRET

# Listener and Relay IPs
listening-ip=$IPV4
listening-ip=$IPV6
relay-ip=$IPV4
relay-ip=$IPV6

# Ports
min-port=49152
max-port=65535

# Disable alternative ports (cleaner setup if RFC 5780 not used/supported)
alt-listening-port=0
alt-tls-listening-port=0

# Certificates
cert=$CERT_PATH
pkey=$KEY_PATH

# Logging and Security
verbose
fingerprint
no-multicast-peers
EOF

# 4. Permissions and Service
echo ">>> Setting permissions and restarting service..."

# Grant CAP_NET_BIND_SERVICE to allow binding to port 443
mkdir -p /etc/systemd/system/coturn.service.d
printf '[Service]\nAmbientCapabilities=CAP_NET_BIND_SERVICE\nCapabilityBoundingSet=CAP_NET_BIND_SERVICE\n' > /etc/systemd/system/coturn.service.d/override.conf
systemctl daemon-reload

systemctl enable coturn
systemctl restart coturn

# 5. Certbot Renewal Hook
echo ">>> Configuring Certbot renewal hook..."
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/coturn-reload.sh <<EOF
#!/bin/bash
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/coturn/certs/turn_server_cert.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/coturn/certs/turn_server_pkey.pem
chown turnserver:turnserver /etc/coturn/certs/turn_server_cert.pem /etc/coturn/certs/turn_server_pkey.pem
chmod 600 /etc/coturn/certs/turn_server_pkey.pem
systemctl restart coturn
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/coturn-reload.sh

echo ">>> Deployment Complete!"
echo "Turn server is running on $DOMAIN (Ports 3478, 443)"

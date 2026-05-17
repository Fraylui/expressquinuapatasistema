FROM nginx:1.25-alpine

COPY nginx.conf.template /nginx.conf.template
COPY nginx-init.conf     /nginx-init.conf
COPY entrypoint.sh       /docker-entrypoint.d/40-domain-substitute.sh

RUN chmod +x /docker-entrypoint.d/40-domain-substitute.sh

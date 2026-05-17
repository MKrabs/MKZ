// Runtime environment configuration.
// In production (Docker) this file is overwritten by docker-entrypoint.sh
// with the actual server URLs. In local development the defaults below apply.
window.__ENV__ = {
  PB_URL: "http://127.0.0.1:8090"
};

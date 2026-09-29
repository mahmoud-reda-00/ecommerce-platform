#!/usr/bin/env bash
set -uo pipefail

PASS=0
FAIL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "PASS: $desc"
    PASS=$((PASS+1))
  else
    echo "FAIL: $desc (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

code() {
  curl -s -o /dev/null -w '%{http_code}' "$@"
}

echo "== Health & readiness =="
check "products /health" 200 "$(code localhost:3000/health)"
check "products /ready"  200 "$(code localhost:3000/ready)"
check "users /health"    200 "$(code localhost:3001/health)"
check "users /ready"     200 "$(code localhost:3001/ready)"
check "orders /health"   200 "$(code localhost:3002/health)"
check "orders /ready"    200 "$(code localhost:3002/ready)"

echo "== Products =="
check "POST /products valid"          201 "$(code -X POST localhost:3000/products -H 'Content-Type: application/json' -d '{"name":"Mouse","price":25.0}')"
check "POST /products missing name"   400 "$(code -X POST localhost:3000/products -H 'Content-Type: application/json' -d '{"price":10}')"
check "POST /products negative price" 400 "$(code -X POST localhost:3000/products -H 'Content-Type: application/json' -d '{"name":"Bad","price":-1}')"
check "GET /products list"            200 "$(code localhost:3000/products)"
check "GET /products/1"               200 "$(code localhost:3000/products/1)"
check "GET /products/99999 (404)"     404 "$(code localhost:3000/products/99999)"
check "GET /products/abc (400)"       400 "$(code localhost:3000/products/abc)"

echo "== Users =="
RAND_EMAIL="test$RANDOM@example.com"
check "POST /users valid"             201 "$(code -X POST localhost:3001/users -H 'Content-Type: application/json' -d "{\"name\":\"Test\",\"email\":\"$RAND_EMAIL\"}")"
check "POST /users duplicate email"   409 "$(code -X POST localhost:3001/users -H 'Content-Type: application/json' -d "{\"name\":\"Test\",\"email\":\"$RAND_EMAIL\"}")"
check "POST /users bad email"         400 "$(code -X POST localhost:3001/users -H 'Content-Type: application/json' -d '{"name":"Bad","email":"notanemail"}')"
check "GET /users list"               200 "$(code localhost:3001/users)"
check "GET /users/1"                  200 "$(code localhost:3001/users/1)"
check "GET /users/99999 (404)"        404 "$(code localhost:3001/users/99999)"

echo "== Orders (cross-service) =="
check "POST /orders valid"                201 "$(code -X POST localhost:3002/orders -H 'Content-Type: application/json' -d '{"user_id":1,"product_id":1,"quantity":1}')"
check "POST /orders missing product"      400 "$(code -X POST localhost:3002/orders -H 'Content-Type: application/json' -d '{"user_id":1,"product_id":99999,"quantity":1}')"
check "POST /orders missing user"         400 "$(code -X POST localhost:3002/orders -H 'Content-Type: application/json' -d '{"user_id":99999,"product_id":1,"quantity":1}')"
check "POST /orders bad quantity"         400 "$(code -X POST localhost:3002/orders -H 'Content-Type: application/json' -d '{"user_id":1,"product_id":1,"quantity":0}')"
check "GET /orders list"                  200 "$(code localhost:3002/orders)"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
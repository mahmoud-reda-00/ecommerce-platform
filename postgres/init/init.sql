CREATE USER products_user WITH PASSWORD 'products_pass';
CREATE USER orders_user   WITH PASSWORD 'orders_pass';
CREATE USER users_user    WITH PASSWORD 'users_pass';

CREATE DATABASE products_db OWNER products_user;
CREATE DATABASE orders_db   OWNER orders_user;
CREATE DATABASE users_db    OWNER users_user;

REVOKE CONNECT ON DATABASE products_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE orders_db   FROM PUBLIC;
REVOKE CONNECT ON DATABASE users_db    FROM PUBLIC;
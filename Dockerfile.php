FROM php:8.2-fpm

# Install dependencies needed for Postgres, GD, and Imagick
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libwebp-dev \
    libfreetype6-dev \
    libmagickwand-dev \
    imagemagick \
    git \
    unzip \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        gd \
    && pecl install imagick \
    && docker-php-ext-enable imagick \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set standard PHP configurations
RUN echo "upload_max_filesize = 16M\npost_max_size = 16M" > /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html

COPY . /var/www/html/

# PHP-FPM natively communicates on port 9000
EXPOSE 9000
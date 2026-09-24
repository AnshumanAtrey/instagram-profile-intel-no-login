# Browser-based scraping needs a real Chromium. Apify's playwright-chrome image ships Node 22
# plus Playwright and a matching Chromium at /pw-browsers. We install only our own prod deps
# (--omit=dev) and rely on the image's pre-baked Playwright + Chromium — reinstalling them is
# both unnecessary and blocked (/pw-browsers is root-owned).
FROM apify/actor-node-playwright-chrome:22

COPY --chown=myuser:myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version

COPY --chown=myuser:myuser . ./

CMD npm start --silent

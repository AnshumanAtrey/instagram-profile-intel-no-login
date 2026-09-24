# Browser-based scraping needs Chromium. The playwright-chrome image provides the system libs
# Chromium needs, but its pre-baked browser lives at a root-owned path we cannot match to our
# pinned Playwright. So we point PLAYWRIGHT_BROWSERS_PATH at a writable dir and install the
# Chromium that matches our Playwright version there.
FROM apify/actor-node-playwright-chrome:22

ENV PLAYWRIGHT_BROWSERS_PATH=/home/myuser/pw-browsers

COPY --chown=myuser:myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && npx playwright install chromium \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && node --version

COPY --chown=myuser:myuser . ./

CMD npm start --silent

# Browser-based Instagram profile scraping needs a real Chromium. Apify's playwright-chrome
# image ships Node 22 + Playwright + Chromium. We reinstall chromium for the exact Playwright
# version in package.json so the two always match.
FROM apify/actor-node-playwright-chrome:22

COPY --chown=myuser:myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && npx playwright install chromium \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version

COPY --chown=myuser:myuser . ./

CMD npm start --silent

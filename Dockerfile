# Use Node.js LTS
FROM node:18-alpine

# Set working directory to backend
WORKDIR /app/backend

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the entire project
COPY . /app

# Expose port
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
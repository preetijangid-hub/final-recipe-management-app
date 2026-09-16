# Savoré — Recipe Management App

Savoré is a full-stack Recipe Management Application that allows users to discover, create, manage, and organize recipes through a clean and responsive web interface.

The application provides secure authentication, recipe CRUD operations, search and filtering, cuisine and meal category based discovery, authorization, recipe ratings, and a food assistant.

---

## ✨ Features

### Authentication & Authorization

* User registration and login
* Password hashing with bcrypt
* JWT-based authentication
* Protected routes
* Automatic authentication handling
* User logout
* Role-based authorization
* Recipe ownership protection
* Owner can edit and delete their own recipes
* Different users cannot modify another user's recipes
* Proper 401 and 403 authorization handling

### Recipe Management

* Create recipes
* View recipes
* View recipe details
* Edit own recipes
* Delete own recipes
* Ingredients and preparation steps
* Spice level
* Sweetness level
* Recipe images
* Recipe ratings
* Recipe order count

### Recipe Discovery

* Browse all recipes
* Search recipes
* Filter recipes by cuisine
* Filter recipes by meal category
* Combine cuisine and meal category filters
* Pagination
* Sorting
* Recipe detail pages

### Categories

#### Cuisines

* Indian
* Italian
* Mexican
* Thai
* Chinese
* Japanese
* Korean
* French
* American
* Mediterranean

#### Meal Categories

* Breakfast
* Brunch
* Lunch
* Dinner
* Dessert
* Snacks
* Mocktails
* Drinks

### Dashboard

* Total recipes
* My recipes
* Available categories
* Recipes added this week
* Explore by category
* Featured recipe
* Quick actions

### User Experience

* Responsive design
* Mobile-friendly layout
* Loading states
* Error states
* Empty states
* Clean Savoré visual design
* Protected navigation
* 404 page
* Angular Material

### Food Assistant

* Recipe preference based assistance
* Recipe matching
* Food preference management

---

## 🌐 Live Demo

### Frontend

https://savore-fnph.onrender.com

### Backend / API

https://savore-lz8a.onrender.com

---

## 🛠️ Tech Stack

### Frontend

* Angular
* TypeScript
* RxJS
* Angular Router
* Angular HttpClient
* Angular Material
* HTML5
* CSS3

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT
* bcrypt
* express-validator
* Helmet
* CORS
* express-rate-limit

### Testing

* Jest
* Supertest
* Angular testing tools

### Database & Deployment

* MongoDB Atlas
* Render
* Angular frontend hosting

---

## 📁 Project Structure

```text
final-recipe-management-app/
│
├── client/
│   └── recipe-client/
│       ├── src/
│       │   └── app/
│       ├── public/
│       │   └── images/
│       ├── package.json
│       └── angular.json
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── tests/
│   ├── server.js
│   └── package.json
│
├── docs/
│   └── screenshots/
│       ├── login.png
│       ├── register.png
│       ├── dashboard.png
│       ├── recipes.png
│       ├── categories.png
│       ├── my-recipes.png
│       ├── add-recipe.png
│       ├── recipe-details.png
│       └── authorization-403.png
│
├── .gitignore
└── README.md
```

The `docs/screenshots` directory contains the screenshots used in this documentation. Generated files, environment secrets, and local machine-specific files are not part of the documented project structure.

---

## 🚀 Getting Started

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Angular CLI
* MongoDB Atlas account or MongoDB instance

### Clone the Repository

```bash
git clone https://github.com/preetijangid-hub/final-recipe-management-app.git
cd final-recipe-management-app
```

---

## ⚙️ Backend Setup

Move into the server directory:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Create a `.env` file inside the `server` directory and configure the required environment variables.

Start the backend using the development script defined in the project:

```bash
npm run dev
```

The backend runs on the configured server port.

---

## 💻 Frontend Setup

Open a new terminal and move into the Angular application:

```bash
cd client/recipe-client
```

Install dependencies:

```bash
npm install
```

Start the Angular development server:

```bash
ng serve
```

The frontend is available locally at:

```text
http://localhost:4200
```

---

## 🔐 Environment Variables

The backend uses environment variables for database access, authentication, server configuration, and frontend CORS configuration.

Create:

```text
server/.env
```

Example configuration:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
CLIENT_URL=http://localhost:4200
```

### Environment Variable Reference

| Variable      | Purpose                                     |
| ------------- | ------------------------------------------- |
| `MONGODB_URI` | MongoDB database connection string          |
| `JWT_SECRET`  | Secret used for JWT authentication          |
| `PORT`        | Port used by the backend server             |
| `CLIENT_URL`  | Frontend origin used for CORS configuration |

**Never commit real credentials, passwords, tokens, or secret values to the repository.**

---

## 📡 API Overview

The Savoré backend provides REST APIs for authentication, recipes, categories, and the food assistant.

### Authentication API

Base route:

```text
/api/auth
```

Provides authentication-related functionality including:

* User registration
* User login
* Authentication
* Current-user related operations

### Recipe API

Base route:

```text
/api/recipes
```

Provides recipe functionality including:

* Recipe listing
* Recipe search
* Recipe filtering
* Recipe creation
* Recipe details
* Recipe updates
* Recipe deletion
* Recipe ratings

Recipe modification operations are protected by authentication and ownership rules.

### Category API

Base route:

```text
/api/categories
```

Provides category and recipe discovery functionality for cuisines and meal categories.

### Food Assistant API

Base route:

```text
/api/assistant
```

Provides food assistant functionality including recipe preference-based assistance and recipe matching.

Authentication requirements depend on the individual endpoint.

---

## 🧪 Testing

The backend includes automated API tests using Jest and Supertest.

Testing covers important application behavior such as:

* Authentication
* Protected routes
* Recipe operations
* Input validation
* Authorization
* Error handling
* API responses

The application can also be tested manually through Postman during development.

---

## 📸 Screenshots

### Login

![Savoré Login](docs/screenshots/login.png)

### Register

![Savoré Register](docs/screenshots/register.png)

### Dashboard

![Savoré Dashboard](docs/screenshots/dashboard.png)

### Recipes

![Savoré Recipes](docs/screenshots/recipes.png)

### Categories

![Savoré Categories](docs/screenshots/categories.png)

### My Recipes

![Savoré My Recipes](docs/screenshots/my-recipes.png)

### Add Recipe

![Savoré Add Recipe](docs/screenshots/add-recipe.png)

### Recipe Details

![Savoré Recipe Details](docs/screenshots/recipe-details.png)

### Authorization

![Savoré Authorization](docs/screenshots/authorization-403.png)

---

## 🔒 Security

Savoré follows standard application security practices:

* Passwords are hashed using bcrypt.
* JWT is used for authentication.
* Protected routes require valid authentication.
* Recipe ownership is checked before modification.
* Input validation is handled using `express-validator`.
* CORS is configured for the frontend application.
* Helmet is used for HTTP security headers.
* Rate limiting is used for API protection.
* Environment secrets are kept outside the source code.
* `.env` files are excluded from version control.
* Unauthorized requests return appropriate HTTP status codes.

---

## 🗄️ Database

Savoré uses MongoDB with Mongoose for persistent data storage.

MongoDB Atlas is used for the deployed database environment.

Main application models include:

* User
* Recipe
* Category-related data

Mongoose schemas provide structured database models and relationships used by the application.

---

## 🌍 Deployment

The application is deployed using Render.

### Frontend

```text
https://savore-fnph.onrender.com
```

### Backend

```text
https://savore-lz8a.onrender.com
```

The frontend communicates with the deployed backend through the configured API and CORS environment settings.

---

## 📌 Development Notes

For local development, keep sensitive configuration inside `server/.env`.

Do not commit:

```text
.env
node_modules/
dist/
.angular/
```

These files and directories are generated or contain environment-specific information and should remain outside version control.

---

## 🎯 Project Goals

Savoré was developed to demonstrate a complete full-stack application workflow using the MEAN stack.

The project brings together:

```text
Angular
   ↓
Angular Services
   ↓
HTTP / REST API
   ↓
Express.js
   ↓
Authentication & Authorization
   ↓
Mongoose
   ↓
MongoDB Atlas
```

The application demonstrates practical experience in frontend development, backend API development, database integration, authentication, authorization, validation, testing, deployment, and responsive UI development.

---

## 👩‍💻 Developer

**Preeti Jangid**

B.Tech — Computer Science & Engineering

GitHub:

https://github.com/preetijangid-hub/final-recipe-management-app

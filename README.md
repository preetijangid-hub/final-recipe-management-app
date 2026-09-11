# Savoré — Recipe Management App

Savoré is a full-stack Recipe Management Application that allows users to discover, create, manage, and organize recipes through a clean and responsive web interface.

The application provides secure authentication, recipe CRUD operations, search and filtering, cuisine and meal category based discovery, authorization, recipe ratings, and a food assistant.

---

## ✨ Features

### Authentication & Authorization

- User registration and login
- Password hashing with bcrypt
- JWT-based authentication
- Protected routes
- Automatic authentication handling
- User logout
- Role-based authorization
- Recipe ownership protection
- Owner can edit and delete their own recipes
- Different users cannot modify another user's recipes
- Proper 401 and 403 authorization handling

### Recipe Management

- Create recipes
- View recipes
- View recipe details
- Edit own recipes
- Delete own recipes
- Ingredients and preparation steps
- Spice level
- Sweetness level
- Recipe images
- Recipe ratings
- Recipe order count

### Recipe Discovery

- Browse all recipes
- Search recipes
- Filter recipes by cuisine
- Filter recipes by meal category
- Combine cuisine and meal category filters
- Pagination
- Sorting
- Recipe detail pages

### Categories

#### Cuisines

- Indian
- Italian
- Mexican
- Thai
- Chinese
- Japanese
- Korean
- French
- American
- Mediterranean

#### Meal Categories

- Breakfast
- Brunch
- Lunch
- Dinner
- Dessert
- Snacks
- Mocktails
- Drinks

### Dashboard

- Total recipes
- My recipes
- Available categories
- Recipes added this week
- Explore by category
- Featured recipe
- Quick actions

### User Experience

- Responsive design
- Mobile-friendly layout
- Loading states
- Error states
- Empty states
- Clean Savoré visual design
- Protected navigation
- 404 page
- Angular Material

### Food Assistant

- Recipe preference based assistance
- Recipe matching
- Food preference management

---

## 🛠️ Tech Stack

### Frontend

- Angular
- TypeScript
- RxJS
- Angular Router
- Angular HttpClient
- Angular Material
- HTML5
- CSS3

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcrypt
- express-validator
- Helmet
- CORS
- express-rate-limit

### Testing

- Jest
- Supertest
- Angular testing tools

### Database & Deployment

- MongoDB Atlas
- Render
- Angular frontend hosting

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
│   ├── .env
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
└── README.md

 c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174402.png c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174416.png c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174429.png c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174502.png c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174525.png c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174555.png c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174624.png c:\Users\91902\Pictures\Screenshots\Screenshot 2026-09-11 174640.png

const express = require("express");
const { body, param } = require("express-validator");

const protect = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validationMiddleware");
const {
  getShoppingList,
  refreshShoppingList,
  toggleShoppingListItem,
} = require("../controllers/shoppingListController");

const router = express.Router();

router.use(protect);

router.get("/", getShoppingList);
router.post("/refresh", refreshShoppingList);
router.patch(
  "/:id/items",
  [
    param("id").isMongoId().withMessage("A valid shopping list id is required."),
    body("itemName").trim().notEmpty().withMessage("itemName is required."),
    body("checked").isBoolean().withMessage("checked must be a boolean."),
  ],
  validateRequest,
  toggleShoppingListItem
);

module.exports = router;

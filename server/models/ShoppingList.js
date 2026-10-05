const mongoose = require("mongoose");

const shoppingListItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      default: "",
      trim: true,
    },
    kind: {
      type: String,
      enum: ["count", "weight", "volume", "unknown"],
      default: "count",
    },
    checked: {
      type: Boolean,
      default: false,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    usedIn: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const shoppingListSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    weekStart: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    items: {
      type: [shoppingListItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

shoppingListSchema.index({ user: 1, weekStart: 1 }, { unique: true });

const ShoppingList = mongoose.model("ShoppingList", shoppingListSchema);

module.exports = ShoppingList;

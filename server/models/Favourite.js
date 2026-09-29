const mongoose = require("mongoose");

const favouriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can favourite a recipe only once. The unique index makes the
// rule airtight even under concurrent requests.
favouriteSchema.index({ user: 1, recipe: 1 }, { unique: true });

const Favourite = mongoose.model("Favourite", favouriteSchema);

module.exports = Favourite;

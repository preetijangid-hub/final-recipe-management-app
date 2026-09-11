const mongoose = require("mongoose");

const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 };

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
  },
  {
    timestamps: true,
    collation: CASE_INSENSITIVE_COLLATION,
  }
);

categorySchema.index(
  { name: 1 },
  { unique: true, collation: CASE_INSENSITIVE_COLLATION }
);

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
module.exports.CASE_INSENSITIVE_COLLATION = CASE_INSENSITIVE_COLLATION;
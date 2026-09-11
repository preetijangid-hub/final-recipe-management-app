const Category = require("../models/Category");
const Recipe = require("../models/Recipe");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCategoryNameError = (name) => {
  if (typeof name !== "string" || !name.trim()) {
    return "Category name is required.";
  }

  if (name.trim().length < 2 || name.trim().length > 50) {
    return "Category name must be between 2 and 50 characters.";
  }

  return null;
};

// @desc    Get all categories (managed categories merged with
//          distinct category values already used by recipes)
// @route   GET /api/categories
const getCategories = async (req, res, next) => {
  try {
    const [managedCategories, recipeCategories] = await Promise.all([
      Category.find().sort({ name: 1 }),
      Recipe.aggregate([
        {
          $match: {
            category: { $type: "string", $nin: [""] },
          },
        },
        {
          $group: {
            _id: { $toLower: "$category" },
            name: { $min: "$category" },
          },
        },
        {
          $project: {
            _id: 0,
            lowerName: "$_id",
            name: 1,
          },
        },
      ]),
    ]);

    const categories = managedCategories.map((category) => ({
      _id: category._id,
      name: category.name,
      managed: true,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));

    const managedNames = new Set(
      categories.map((category) => category.name.toLowerCase())
    );

    for (const recipeCategory of recipeCategories) {
      if (!managedNames.has(recipeCategory.lowerName)) {
        categories.push({
          _id: null,
          name: recipeCategory.name,
          managed: false,
        });
      }
    }

    categories.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new category (admin only)
// @route   POST /api/categories
const createCategory = async (req, res, next) => {
  try {
    const nameError = getCategoryNameError(req.body.name);

    if (nameError) {
      return res.status(400).json({ message: nameError });
    }

    const name = req.body.name.trim();

    const existing = await Category.findOne({ name });

    if (existing) {
      return res.status(409).json({
        message: `A category named "${existing.name}" already exists.`,
      });
    }

    const category = await Category.create({ name });

    res.status(201).json({
      message: "Category created successfully.",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A category with this name already exists.",
      });
    }

    next(error);
  }
};

// @desc    Update a category (admin only)
// @route   PUT /api/categories/:id
const updateCategory = async (req, res, next) => {
  try {
    const nameError = getCategoryNameError(req.body.name);

    if (nameError) {
      return res.status(400).json({ message: nameError });
    }

    const name = req.body.name.trim();

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const duplicate = await Category.findOne({
      name,
      _id: { $ne: category._id },
    });

    if (duplicate) {
      return res.status(409).json({
        message: `A category named "${duplicate.name}" already exists.`,
      });
    }

    const previousName = category.name;
    let renamedRecipes = 0;

    if (previousName !== name) {
      const result = await Recipe.updateMany(
        {
          category: {
            $regex: `^${escapeRegex(previousName)}$`,
            $options: "i",
          },
        },
        { $set: { category: name } }
      );

      renamedRecipes = result.modifiedCount ?? 0;
    }

    category.name = name;
    await category.save();

    res.status(200).json({
      message:
        renamedRecipes > 0
          ? `Category updated. ${renamedRecipes} ${
              renamedRecipes === 1 ? "recipe" : "recipes"
            } now use the new name.`
          : "Category updated successfully.",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A category with this name already exists.",
      });
    }

    next(error);
  }
};

// @desc    Delete a category (admin only)
// @route   DELETE /api/categories/:id
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const recipesUsingCategory = await Recipe.countDocuments({
      category: {
        $regex: `^${escapeRegex(category.name)}$`,
        $options: "i",
      },
    });

    if (recipesUsingCategory > 0) {
      return res.status(409).json({
        message: `"${category.name}" cannot be deleted because ${recipesUsingCategory} ${
          recipesUsingCategory === 1 ? "recipe" : "recipes"
        } currently ${
          recipesUsingCategory === 1 ? "uses" : "use"
        } this category. Move those recipes to another category first.`,
      });
    }

    await Category.findByIdAndDelete(category._id);

    res.status(200).json({
      message: "Category deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
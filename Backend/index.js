const express = require("express");
const cors = require("cors");
require("./database/config");
const User = require("./database/user");
const Product = require("./database/Product");
const Cart = require("./database/Cart")
const Jwt = require("jsonwebtoken");
const jwt_key = "e-comm";

const app = express();
// calling this express function makes it executable 

app.use(express.json());
app.use(cors());


// register/signup route
app.post("/register", async (req, resp) => {
  const { name, role, email, password } = req.body;
  let user = new User({ name,role, email, password });
  let result = await user.save();
  result = result.toObject();
  delete result.password;
  // resp.send(result);



  Jwt.sign({ result }, jwt_key, { expiresIn: "2h" }, (error, token) => {
    if (error) {
      return resp.send({
        result: "Something went wrong. Try again after sometime.",
      });
    }
    // Send the token and user data as a response
    resp.send({ result, auth: token });
  });
});


// login route
app.post("/login", async (req, resp) => {
  if (req.body.password && req.body.email && req.body.role) {
    let user = await User.findOne(req.body).select("-password");
    if (user) {
      
      
      
      // Jwt.sign({ user }, jwt_key, { expiresIn: "2h" }, (error, token) => {
      //   if (error) {
      //     return resp.send({
      //       result: "Something went wrong. Try again after sometime.",
      //     });
      //   }
      //   // Send the token and user data as a response
      //   resp.send({ user, auth: token });
      // });



      Jwt.sign({ user: { _id: user._id, name: user.name, role: user.role } }, jwt_key, { expiresIn: "2h" }, (error, token) => {
        if (error) {
          return resp.send({
            result: "Something went wrong. Try again after sometime.",
          });
        }
        // Send the token and user data as a response
        resp.send({ user, auth: token });
      });

    } else {
      resp.send({ result: "No user found" });
    }
  } else {
    resp.send({ result: "No user found" });
  }
});


// add product route
app.post("/add-product",verifyToken, async (req, resp) => {
  let product = new Product(req.body);
  let result = await product.save();
  resp.send(result);
});


// fetch product route
app.get("/products",verifyToken, async (req, resp) => {
  let products = await Product.find();
  if (products.length > 0) {
    resp.send(products);
  } else {
    resp.send({ result: "no products found" });
  }
});


// delete product route
app.delete("/product/:id",verifyToken, async (req, resp) => {
  const result = await Product.deleteOne({ _id: req.params.id });
  resp.send(result);
});



app.get("/product/:id",verifyToken, async (req, resp) => {
  let result = await Product.findOne({ _id: req.params.id });
  if (result) {
    resp.send(result);
  } else {
    resp.send({ result: "no record found" });
  }
});


app.put("/product/:id",verifyToken, async (req, resp) => {
  let result = await Product.updateOne(
    { _id: req.params.id },
    {
      $set: req.body,
    }
  );
  resp.send(result);
});


// search product route 
app.get("/search/:key", verifyToken, async (req, resp) => {
  let result = await Product.find({
    $or: [
      { name: { $regex: req.params.key } },
      { price: { $regex: req.params.key } },
      { description: { $regex: req.params.key } },
      { category: { $regex: req.params.key } },
    ],
  });
  resp.send(result);
});


// Add product to cart
app.post("/cart", verifyToken, async (req, resp) => {
  const { productId } = req.body;
  const userId = req.user._id; // Assuming you have user info in req.user after token verification

  try {
    let cart = await Cart.findOne({ userId });
    if (cart) {
      // If cart exists, check if product is already in cart
      const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
      if (productIndex > -1) {
        // If product exists, increase quantity
        cart.products[productIndex].quantity += 1;
      } else {
        // If product does not exist, add it
        cart.products.push({ productId });
      }
      await cart.save();
    } else {
      // If cart does not exist, create a new one
      cart = new Cart({ userId, products: [{ productId }] });
      await cart.save();
    }
    resp.send(cart);
  } catch (error) {
    console.error("Error adding to cart:", error);
    resp.status(500).send({ result: "Error adding to cart" });
  }
});


// Get user's cart
app.get("/cart", verifyToken, async (req, resp) => {
  const userId = req.user._id; // Assuming you have user info in req.user after token verification
  try {
    const cart = await Cart.findOne({ userId }).populate("products.productId");
    resp.send(cart || { result: "Cart is empty" });
  } catch (error) {
    console.error("Error fetching cart:", error);
    resp.status(500).send({ result: "Error fetching cart" });
  }
});

// Remove product from cart
app.delete("/cart/:productId", verifyToken, async (req, resp) => {
  const userId = req.user._id; // Assuming you have user info in req.user after token verification
  const { productId } = req.params;

  try {
    const cart = await Cart.findOne({ userId });
    if (cart) {
      cart.products = cart.products.filter(p => p.productId.toString() !== productId);
      await cart.save();
      resp.send(cart);
    } else {
      resp.send({ result: "Cart is empty" });
    }
  } catch (error) {
    console.error("Error removing from cart:", error);
    resp.status(500).send({ result: "Error removing from cart" });
  }
});




// function to vrify the jwt
// function verifyToken(req, resp, next) {
//   let token = req.headers["authorization"];
//   if (token) {
//     token = token.split(" ")[1];
//     Jwt.verify(token, jwt_key, (error, success) => {
//       if (error) {
//         resp.status(401).send({ result: "please provide a valid token" });
//       } else {
//         next();
//       }
//     });
//   } else {
//     resp.status(401).send("please add token with header");
//   }
//   console.warn("midddle ware called", token);
// }


function verifyToken(req, resp, next) {
  let token = req.headers["authorization"];
  if (token) {
    token = token.split(" ")[1];
    Jwt.verify(token, jwt_key, (error, decoded) => { // Change 'success' to 'decoded'
      if (error) {
        resp.status(401).send({ result: "please provide a valid token" });
      } else {
        req.user = decoded.user; // Set req.user to the decoded user object
        next();
      }
    });
  } else {
    resp.status(401).send("please add token with header");
  }
  console.warn("middleware called", token);
}

// listen the port 
app.listen(5000, () => {
  console.log("Server is running on port 5000");
});

const mongoose = require('mongoose')
const productSchema = new mongoose.Schema({
    name:String,
    price:String,
    category:String,
    userId:String,
    description:String
})

module.exports=mongoose.model("products",productSchema)
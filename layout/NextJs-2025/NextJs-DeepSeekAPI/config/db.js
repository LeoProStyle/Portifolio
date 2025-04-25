import mongoose from "mongoose"

let cached = global.mongoose || {conn: null, promise: null};

export default async function connectDB() {
    if(cached.conn) return cached.conn;
    if(!cached.promise){
        cached.promise = (await mongoose.connect(process.env.MONGODB_URI)).then((mongoose)=> mongoose);

    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        console.error("Ocorreu um erro com Mongo DB" , error);
        
    }
    return cached.conn
}
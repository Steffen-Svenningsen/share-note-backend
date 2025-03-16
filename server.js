const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const mongoose = require("mongoose")
const Document = require("./schemas/Document")
require("dotenv").config();

const app = express()
const PORT = process.env.PORT || 3001

app.get('/', (req, res) => {
    res.send('Server is running');
});

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
})

io.on("connection", socket => {
    socket.on('get-document', async documentId => {
        try {
            const document = await findOrCreateDocument(documentId)
            socket.join(documentId)
            socket.emit('load-document', document.data)
    
            socket.on('send-changes', delta => {
                socket.broadcast.to(documentId).emit("receive-changes", delta)
            })

            socket.on("save-document", async data => {
                try {
                    await Document.findByIdAndUpdate(documentId, { data })
                } catch (error) {
                    console.log("Error saving document:", error)
                    socket.emit('database-error', { message: 'Failed to save document. Please try again later.' })
                }
            })
        } catch (error) {
            console.error("Error loading document:", error)
            socket.emit('database-error', { message: 'Failed to load document. Database connection issue.' })
        }
    })
})

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));


const defaultValue = ""

async function findOrCreateDocument(id) {
    if (id == null) throw new Error("Document ID is required")

    try {
        const document = await Document.findById(id)
        if (document) return document
        return await Document.create({
            _id: id,
            data: defaultValue
        })
    } catch (error) {
        console.error("Error finding or creating document:", error)
        throw error
    }

}
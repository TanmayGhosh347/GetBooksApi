const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "goodreads.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        // console.log(payload);
        request.username = payload.username;
        next();
      }
    });
  }
};

//Get Books API
app.get("/books/", authenticateToken, async (request, response) => {
  const getBooksQuery = `
        SELECT
            *
        FROM
            book
        ORDER BY
            book_id;`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

//Get Book API
app.get("/books/:bookId/", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const getBookQuery = `
      SELECT
       *
      FROM
       book 
      WHERE
       book_id = ${bookId};
    `;
  const book = await db.get(getBookQuery);
  response.send(book);
});

//User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// User Profile API
app.get("/profile/", authenticateToken, async (request, response) => {
  const { username } = request;
  //   console.log(username);
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const userDetails = await db.get(getUserQuery);
  response.send(userDetails);
});

//Add Book Api
app.post("/books/", authenticateToken, async (request, response) => {
  const bookDetails = request.body;
  console.log(bookDetails);
  const {
    title,
    authorId,
    rating,
    ratingCount,
    reviewCount,
    description,
    pages,
    dateOfPublication,
    editionLanguage,
    price,
    onlineStores,
  } = bookDetails;

  const addBookApi = `
    INSERT INTO  book
        (title,author_id,rating,rating_count,review_count,description,pages,date_of_publication,edition_language,price,online_stores)
        VALUES ('${title}','${authorId}','${rating}','${ratingCount}','${reviewCount}','${description}','${pages}','${dateOfPublication}','${editionLanguage}','${price}','${onlineStores}');
    `;
  const dbResponse = await db.run(addBookApi);
  //console.log(dbResponse);
  const lastBookId = dbResponse.lastID;
  response.send({ lastBookId: lastBookId });
});

// Update Book API
app.put("/books/:bookId", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const bookDetails = request.body;

  const {
    title,
    authorId,
    rating,
    ratingCount,
    reviewCount,
    description,
    pages,
    dateOfPublication,
    editionLanguage,
    price,
    onlineStores,
  } = bookDetails;

  const updateBookQuery = `
    UPDATE
      book
    SET
      title='${title}',
      author_id=${authorId},
      rating=${rating},
      rating_count=${ratingCount},
      review_count=${reviewCount},
      description='${description}',
      pages=${pages},
      date_of_publication='${dateOfPublication}',
      edition_language='${editionLanguage}',
      price= ${price},
      online_stores='${onlineStores}'
    WHERE
      book_id = ${bookId};`;

  const dbResponse = await db.run(updateBookQuery);
  response.send("Book Updated SuccessFully.");
});

// Delete book API
app.delete("/books/:bookId", authenticateToken, async (request, response) => {
  const { bookId } = request.params;
  const deleteBookQuery = `
        DELETE FROM book 
        WHERE book_id = ${bookId};
    `;
  await db.run(deleteBookQuery);
  response.send("Book Deleted Successfully");
});

// Get Author Books
app.get(
  "/authors/:authorId/books/",
  authenticateToken,
  async (request, response) => {
    const { authorId } = request.params;
    const getAuthorBooksQuery = `
        SELECT
        *
        FROM
            book
        WHERE
            author_id = ${authorId};`;
    const booksArray = await db.all(getAuthorBooksQuery);
    response.send(booksArray);
  }
);

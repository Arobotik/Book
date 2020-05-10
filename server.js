const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;

const pg = require('pg');

const config = {
    host: 'localhost',
    user: 'postgres',
    password: 'password',
    database: 'postgres',
    port: 5432,
    ssl: false
};

const client = new pg.Client(config);

const userConfig = {
    host: 'localhost',
    user: '',
    password: '',
    database: 'postgres',
    port: 5432,
    ssl: false
};

let userClient;

let countOfUserTabs;

let isLoggedIn = false;

async function getInfoFromQuery(client, query, callback){
    await client.query(query, function(err, results){
        if (err){
            throw err;
        }
        result = results;

        return callback(results);
    })
}

client.connect(err => {
    if (err) throw err;
    else {
        queryDatabase();
    }
});

function queryDatabase(){
    let query = `
        ALTER USER postgres WITH PASSWORD 'password';
        CREATE TABLE IF NOT EXISTS users (
            id serial PRIMARY KEY,
            tabName VARCHAR(20),
            name VARCHAR(60),
            login VARCHAR(20)
        );
        
        ALTER TABLE users
            OWNER to postgres;
        GRANT SELECT (id, tabName, name) 
            ON users
            TO PUBLIC;
           
        DO
        $do$
        BEGIN
           IF NOT EXISTS (
              SELECT FROM pg_catalog.pg_roles
              WHERE rolname = 'admins') THEN
              CREATE GROUP admins WITH SUPERUSER CREATEDB CREATEROLE;
           END IF;
           IF NOT EXISTS (
              SELECT FROM pg_catalog.pg_roles
              WHERE rolname = 'admin') THEN
              CREATE ROLE admin PASSWORD 'admin' SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN;
           END IF;
           IF NOT EXISTS (
              SELECT FROM pg_catalog.pg_roles
              WHERE rolname = 'dsr') THEN
              CREATE ROLE dsr PASSWORD 'DSR' SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN;
           END IF;
           ALTER GROUP admins ADD USER admin, DSR;
        END
        $do$;   
            
    `;
    client
        .query(query)
        .then(() => {
            console.log('Table created successfully!');
            //client.end(console.log('Closed client connection'));
        })
        .catch(err => console.log(err));
    let result;
    query = `
        SELECT MAX(id) FROM users
    `;
    getInfoFromQuery(client, query, function(results){
        if (results.rows === undefined){
            result = '0';
        }
        else {
            result = results.rows[0].max;
        }
        countOfUserTabs = Number(result);
    });
}

function convertLogin(login){
    return login.replace('@', '').replace('.','').toLowerCase();
}
function createNewUser(req){
    let query = `
    SELECT MAX(id) 
    FROM users
    `;

    let login = req.body.login.toLowerCase();
    let dataLogin = 'id' + ++countOfUserTabs + 'private';
    let password = req.body.password;
    //PRIVATE
    //login VARCHAR(20),
    //password VARCHAR(20),
    //phones VARCHAR(12)[],
    //requestid INT[],
    //ban-listid INT[],
    query = `
    INSERT INTO users (tabName, login, name)
    VALUES ('${dataLogin}', '${login}', '${req.body.name}');
    
    
    DROP TABLE IF EXISTS ${dataLogin};
    CREATE TABLE ${dataLogin} (
        login VARCHAR(20) PRIMARY KEY,
        password varchar(20) NOT NULL,
        name VARCHAR(60) NOT NULL,
        workPhone VARCHAR(12) NOT NULL,
        privatePhone1 VARCHAR(12),    
        privatePhone2 VARCHAR(12),
        privatePhone3 VARCHAR(12),
        branch VARCHAR(20),
        position VARCHAR(20),       
        workPlace VARCHAR(40),
        about VARCHAR(100),
        banned boolean
    );
        
    INSERT INTO ${dataLogin} (
        login,
        password, 
        name,
        workPhone,
        privatePhone1,    
        privatePhone2,
        privatePhone3,
        branch,
        position,       
        workPlace,
        about,
        banned
    ) 
    VALUES (
        '${login}',
        '${password}', 
        '${req.body.name}',
        '${req.body.workPhone}',
        '${req.body.privatePhone1}',
        '${req.body.privatePhone2}',
        '${req.body.privatePhone3}',
        '${req.body.branch}',
        '${req.body.position}',
        '${req.body.workPlace}',
        '${req.body.about}',
        FALSE);
        
    CREATE ROLE ${convertLogin(login)} PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT LOGIN;
    
    ALTER TABLE ${dataLogin}
        OWNER to postgres;
    GRANT SELECT, UPDATE 
        ON ${dataLogin}
        TO ${convertLogin(login)};
    GRANT SELECT (name, workPhone, branch, position, workPlace, about) 
        ON ${dataLogin}
        TO PUBLIC;
    `;
    console.log('User created successfully!');
    client
        .query(query)
        .then(() => {
            console.log('User created successfully!');
            //client.end(console.log('Closed client connection'));
        });
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API calls
app.get('/loginGet', (req, res) => {
    //console.log(req.body.login + ' ' + req.body.password);
    res.send({ express: 'Please, login:' });
});

let toSend = null;
let anotherUserToSend = null;

 app.get('/bookAllGet', (req, res) => {
    let query = `
        SELECT tabName, name 
        FROM users
    `;

    userClient
        .query(query)
        .then(result => {
            let usersToSend = [];
            for (let row of result.rows){
                console.log('row: ' + row.tabname + ' ' + row.name);
                usersToSend.push([row.tabname, row.name]);
            }
            res.send({express:usersToSend});
        });


    toSend = null;
    anotherUserToSend = null;
});

app.post('/loginPost', (req, res) => {
    console.log(req.body.login + ' ' + req.body.password);
    let query = `
        SELECT rolsuper
            FROM pg_catalog.pg_roles 
            WHERE pg_catalog.pg_roles.rolname = '${convertLogin(req.body.login)}'
    `;

    client
        .query(query)
        .then(result => {
            let adm = result.rows[0].rolsuper;
            console.log(adm);
            if (adm){
                res.send({logged: false});
            }
            else {
                userConfig.password = req.body.password;
                userConfig.user = convertLogin(req.body.login);
                userClient = new pg.Client(userConfig);
                userClient.connect(err => {
                    if (err) {
                        console.log(err);
                        res.send({logged: false});
                    } else {
                        console.log('Entered as ' + req.body.login);
                        isLoggedIn = true;

                        query = `
                            SELECT tabname FROM users WHERE login = '${req.body.login}';
                        `;
                        ///////////////.toLowerCase()}';
                        client.query(query)
                            .then(result => {
                                console.log('RESULT QUERY' + result.rows[0].tabname);
                                res.send({logged: true, tabName: result.rows[0].tabname});
                            });
                    }
                });
            }
        });
});

app.post('/adminLoginPost', (req, res) => {
    console.log(req.body.login + ' ' + req.body.password);
    /*res.send(
        `I received your POST request. This is what you sent me: ${req.body.login} ${req.body.password}`,
    );*/
    let query = `
        SELECT rolsuper
            FROM pg_catalog.pg_roles 
            WHERE pg_catalog.pg_roles.rolname = '${req.body.login.toLowerCase()}'
    `;

    client
        .query(query)
        .then(result => {
            let adm = result.rows[0].rolsuper;
            console.log(adm);
            if (!adm){
                res.send({logged: false});
            }
            else {
                userConfig.password = req.body.password;
                userConfig.user = req.body.login.toLowerCase();
                userClient = new pg.Client(userConfig);
                userClient.connect(err => {
                    if (err) {
                        console.log(err);
                        res.send({logged: false});
                    } else {
                        console.log('Entered as ' + req.body.login);
                        isLoggedIn = true;
                        res.send({logged: true});
                    }
                });
            }
        });
});

app.post('/getInfoAbout', (req, res) => {
    console.log('getInfoAbout' + req.body.key);

    let query = `
        SELECT ${req.body.isThisUser ? '*' : 'name, workPhone, branch, position, workPlace, about'}
        FROM ${req.body.key}
    `;

    userClient
        .query(query)
        .then(result => {
            let row = result.rows[0];
            console.log(row);
            if (req.body.isThisUser){
                res.send({
                    login: row.login,
                    password: row.password,
                    privatePhone1: row.privatePhone1,
                    privatePhone2: row.privatePhone2,
                    privatePhone3: row.privatePhone3,
                    name: row.name,
                    workPhone: row.workphone,
                    branch: row.branch,
                    position: row.position,
                    workPlace: row.workplace,
                    about: row.about,
                });
            }
            else {
                res.send({
                    name: row.name,
                    workPhone: row.workphone,
                    branch: row.branch,
                    position: row.position,
                    workPlace: row.workplace,
                    about: row.about,
                });
            }
        });
});

app.post('/api/register', (req, res) => {
    console.log(req.body.login + ' ' + req.body.password + ' ' + req.body.about);
    createNewUser(req);
    /*res.send(
        `I received your POST request. This is what you sent me: ${req.body.login} ${req.body.password} ${req.body.about}`,
    );*/
});

app.post('/userValidate', (req, res) => {
    console.log(req.body.login);
    //createNewUser(req);
    let query = `
        SELECT login FROM users
        WHERE login = '${req.body.login}';
    `;

    client
        .query(query)
        .then(result => {
            let row = result.rows[0];
            console.log(row);

            res.send({
                validate: row === undefined
            });
        });

    /*res.send(
        `I received your POST request. This is what you sent me: ${req.body.login} ${req.body.password} ${req.body.about}`,
    );*/
});

if (process.env.NODE_ENV === 'production') {
    // Serve any static files
    app.use(express.static(path.join(__dirname, 'client/build')));
    // Handle React routing, return all requests to React app
    app.get('*', function(req, res) {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

app.listen(port, () => console.log(`Listening on port ${port}`));
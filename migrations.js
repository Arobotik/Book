const serverutils = require('./serverutils');

module.exports.createDatabase = function(client){
    let query = `
        CREATE TABLE IF NOT EXISTS users (
            id serial PRIMARY KEY,
            login VARCHAR(25),
            password VARCHAR, 
            name VARCHAR(60),
            birthDate DATE,
            workPhone VARCHAR(17),
            privatePhone1 VARCHAR(17),   
            privatePhone2 VARCHAR(17),   
            privatePhone3 VARCHAR(17),   
            branch VARCHAR(20),   
            position VARCHAR(20),          
            workPlace VARCHAR(20),   
            about VARCHAR(100),  
            avatar SMALLINT ARRAY, 
            lastVisited INTEGER ARRAY,
            hideYear BOOLEAN,
            hidePhones BOOLEAN,
            banned BOOLEAN
        );
        
        CREATE TABLE IF NOT EXISTS requests (
            id serial PRIMARY KEY,
            target INTEGER,
            requesting INTEGER,
            sendDate DATE,
            status INT
        );
        
        CREATE TABLE IF NOT EXISTS branches(
            id serial PRIMARY KEY,
            branch VARCHAR(40)
        );

        DROP TABLE IF EXISTS admins;
        CREATE TABLE IF NOT EXISTS admins (
            login VARCHAR(20) PRIMARY KEY,
            password VARCHAR
        );    
        
        INSERT INTO admins (login, password) 
            VALUES ('admin', '${serverutils.encrypt('admin')}'),
                   ('DSR', '${serverutils.encrypt('DSR')}'),
                   ('aro', '${serverutils.encrypt('aro')}');
            
        ALTER TABLE users
            OWNER to postgres;
        ALTER TABLE admins
            OWNER to postgres;
        ALTER TABLE requests
            OWNER to postgres;
    `;
    client
        .query(query);
};
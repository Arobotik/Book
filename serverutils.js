let bcrypt = require('bcryptjs');
const querycreate = require('./querycreate');

connections = new Map();
adminConnections = [];
module.exports.connections = connections;
module.exports.adminConnections = adminConnections;

function encrypt(text) {
    let bcrypt = require('bcryptjs');
    let salt = bcrypt.genSaltSync(10);
    return hash = bcrypt.hashSync(text, salt);
}

function decrypt(text, hash) {
    return bcrypt.compareSync(text, hash);
}

module.exports.checkConnection = function(session){
    return connections.get(session) !== undefined;
};

module.exports.checkAdminConnection = function(session){
    return adminConnections.find(item => item === session);
};

module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;

module.exports.makeAuth = function(id, admin = false){
    const uuid = encrypt(id.toString()).replace(/\//g,'');
    if (admin){
        adminConnections.push(uuid);
    }
    else{
        connections.set(uuid, id);
    }
    return uuid;
};



 module.exports.getIdBySession = function(session){
    let id = connections.get(session);
    return  id !== undefined ? id : -1;
};

module.exports.onAddInLastVisited = function(id, requesting, client){
    client
        .query(querycreate.selectLastVisited(requesting))
        .then(result => {
            if (Number(id) !== Number(requesting)){
                let lastVisited = addInLastVisited(Number(id), result.rows[0] !== undefined ? result.rows[0].lastvisited : []);

                client
                    .query(querycreate.updateLastVisited(lastVisited, requesting));
            }
        });
};

addInLastVisited = function(id, lastVisited){
    if (lastVisited === null)
        lastVisited = [];
    if (id !== -1) {
        let ind = lastVisited.findIndex(item => item === id);
        if (ind !== -1) {
            lastVisited.unshift(lastVisited[ind]);
            lastVisited.splice(ind + 1, 1);
        } else {
            lastVisited.unshift(id);
        }
        lastVisited.length = lastVisited.length > 9 ? 9 : lastVisited.length;
    }
    return lastVisited;
};

module.exports.addInLastVisited = addInLastVisited;

module.exports.findNameById = function(ids, toFind){
    for (let user of ids){
        if (user.id === Number(toFind)){
            return [user.id, user.name];
        }
    }
};

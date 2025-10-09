const env = process.env.NODE_ENV == "production" ? "production" : "development";

const common = {
};

const development = {
    ...common
};

const production = {
    ...common,
};

const config = {
    development,
    production,
};

module.exports = config[env];

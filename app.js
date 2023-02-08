const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const myApp = express();
myApp.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let database;

const initializeServerAndDB = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    myApp.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(error.message);
  }
};

initializeServerAndDB();

const tokenAuthentication = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const tokenVerify = await jwt.verify(
      jwtToken,
      "qwertyuiop",
      (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      }
    );
  }
};

//api 1
myApp.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userCheck = `
    SELECT *
    FROM user
    WHERE username = '${username}'`;
  const userIN = await database.get(userCheck);
  if (userIN === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePassword = await bcrypt.compare(password, userIN.password);
    if (comparePassword === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "qwertyuiop");
      response.send({ jwtToken });
    }
  }
});

//api 2
myApp.get("/states/", tokenAuthentication, async (request, response) => {
  const getALlStates = `
    SELECT *
    FROM state`;
  const states = await database.all(getALlStates);
  response.send(
    states.map((each) => {
      return {
        stateId: each.state_id,
        stateName: each.state_name,
        population: each.population,
      };
    })
  );
});

//api 3
myApp.get(
  "/states/:stateId/",
  tokenAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateById = `
    SELECT * 
    FROM state
    WHERE state_id = '${stateId}'`;
    const state = await database.get(getStateById);
    const func = (state) => {
      return {
        stateId: state.state_id,
        stateName: state.state_name,
        population: state.population,
      };
    };
    response.send(func(state));
  }
);

//api 4
myApp.post("/districts/", tokenAuthentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertDistrictQuery = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES 
      (
          '${districtName}',
          '${stateId}',
          '${cases}',
          '${cured}',
          '${active}',
          '${deaths}'
      )`;
  const insertDistrict = await database.run(insertDistrictQuery);
  response.send("District Successfully Added");
});

//api 5
myApp.get(
  "/districts/:districtId/",
  tokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictById = `
    SELECT *
    FROM district
    WHERE district_id = '${districtId}'`;
    const district = await database.get(getDistrictById);
    response.send(func(district));
    function func(district) {
      return {
        districtId: district.district_id,
        districtName: district.district_name,
        stateId: district.state_id,
        cases: district.cases,
        cured: district.cured,
        active: district.active,
        deaths: district.deaths,
      };
    }
  }
);

//api 6
myApp.delete(
  "/districts/:districtId/",
  tokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
    DELETE FROM
      district
    WHERE district_id = '${districtId}'`;
    try {
      const delDistrict = await database.run(deleteDistrict);
      response.send("District Removed");
    } catch (e) {
      console.log(e.message);
    }
  }
);

//api 7
myApp.put(
  "/districts/:districtId/",
  tokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrict = `
    UPDATE 
      district
    SET 
      district_name = '${districtName}',
      state_id = '${stateId}',
      cases = '${cases}',
      cured = '${cured}',
      active = '${active}',
      deaths = '${deaths}'
    WHERE 
      district_id = '${districtId}'`;
    try {
      const update = await database.run(updateDistrict);
      response.send("District Details Updated");
    } catch (e) {
      console.log(e.message);
    }
  }
);

//api 8
myApp.get(
  "/states/:stateId/stats/",
  tokenAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
      FROM 
      district
    WHERE 
      state_id = '${stateId}'
    GROUP BY 
      state_id`;
    try {
      const res = await database.get(query);
      response.send({
        totalCases: res["SUM(cases)"],
        totalCured: res["SUM(cured)"],
        totalActive: res["SUM(active)"],
        totalDeaths: res["SUM(deaths)"],
      });
    } catch (e) {
      console.log(e.message);
    }
  }
);

module.exports = myApp;

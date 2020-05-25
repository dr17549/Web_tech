const express = require("express");
const router = express.Router();
const session = require("express-session");
const User = require("../models/user");
const Counter = require("../models/counter");
const Story = require("../models/story");
const Graph = require("../models/graph");
const Template = require("../models/graph_template");
const bcrypt = require("bcrypt");
const helper = require("./helper.js");
const nodemailer = require("nodemailer");

//////////////////////////////BASE PAGES////////////////////////////////

// get handler for /
// title is the title of the page
// the "active" key determines which link in the menu is active
router.get("/", async (req, res) => {
  res.render("index", {
    title: "Graphite",
    home: "active",
    user: req.session.user,
  });
});

// get handler for /login
router.get("/login", async (req, res) => {
  res.render("login", {
    title: "Graphite",
    login: "active",
    user: req.session.user,
  });
});

// post handler for /login, triggers authenticateUser function
router.post("/login", authenticateUser, async (req, res) => {});

// get handler for /register
router.get("/register", async (req, res) => {
  res.render("register", {
    title: "Graphite",
    login: "active",
    user: req.session.user,
  });
});

// post handler for /register
router.post("/register", async (req, res) => {
  // creates a new User object from the body of the form submitted
  const user = new User({
    email: req.body.email,
    password: req.body.password,
  });
  
  // updates the id counter for user, to mimic an auto-increment field
  // ensures each new user has a unique id they can be referenced with
  Counter.findByIdAndUpdate({ _id: "userID" }, { $inc: { seq: 1 } }, function (error, counter) {
    // TODO: update error handling
    if (error) {
      res.render("register", {
        title: "Graphite",
        login: "active",
        message: err.message,
      });
    }
    // actually set the id in the user object
    user.user_ID = counter.seq;
  });

  // attempt to save the new user object
  try {
    const newUser = await user.save();
  } catch (err) {
    // TODO: update error handling
    res.render("register", {
      title: "Graphite",
      login: "active",
      message: err.message,
    });
    res.status(400).json({ message: err.message });
  }

  // logs the user in and redirects to the homepage
  req.session.user = user;
  res.render("index", {
    title: "Graphite",
    home: "active",
    user: req.session.user,
  });
});

// get handler for /logout
router.get("/logout", async (req, res) => {
  if (req.session) {
    // destroys the session
    req.session.destroy(function (err) {
      if (err) {
        // TODO: figure out how exactly this next() is working
        return next(err);
      } else {
        res.render("login", { title: "Graphite", login: "active", user: null });
      }
    });
  }
});

// get handler for /forgot_password
router.get("/forgot_password", (req, res) => {
  res.render("forget_password", {
    title: "Graphite",
    login: "active",
    user: req.session.user,
  });
});

// post handler for /forgot_password
router.post("/forgot_password", async (req, res) => {
  // attempt to find user with email
  user = await User.findOne({ email: req.body.email });

  if (user == null) {
    // TODO: handle errors properly
    return res
      .status(404)
      .json({ message: "User not found! Please enter a valid email." });
  } else {
    // create random string
    var randomstring = Math.random().toString(36).slice(-8);
    
    // reset user details
    if (req.body.email != null) {
      user.email = req.body.email;
    }
    user.password = randomstring;
    
    // TODO: ask Zen if working!
    try {
      // this is not working
      const updateuser = await user.save();
    } catch (err) {
      res.status(400).json({ message: err.message });
    }

    // email the new details
    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "graphite.website.official@gmail.com",
        pass: "graphiteabc123",
      },
    });

    // the body of the email
    // TODO: elaborate
    var mailOptions = {
      from: "graphite.website.official@gmail.com",
      to: req.body.email,
      subject: "Reset Passsword",
      text: "Please use this password to login : " + randomstring,
    };

    // actually sends the email
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        res.render("index", {
          title: "Graphite",
          home: "active",
          message:
            "Email sent to your account! Please log-in with the temporary password.",
        });
      }
    });
  }
});

// get handler for /reset_password
router.get("/reset_password", requiresLogin, (req, res) => {
  res.render("reset_password", {
    title: "Graphite",
    login: "active",
    user: req.session.user,    
  });
});

// post handler for /reset_password
router.post("/reset_password", requiresLogin, async (req, res) => {
  // find user
  user = await User.findOne({ email: req.session.user.email });
  
  const password = req.body.password;
  const confirm_password = req.body.confirm_password;
  
  // if the passwords don't match, throw error
  if (password.localeCompare(confirm_password) != 0) {
    // TODO: handle errors properly
    res.render(
      res.render("reset_password", {
        title: "Graphite",
        home: "active",
        user: req.session.user,
        message: "Password not the same! Please try again",
      })
    );
  }

  // attempt to update password
  try {
    user.password = password;
    const updateuser = await user.save();
  } catch (err) {
    // TODO: handle errors properly
    res.render("reset_password", {
      title: "Graphite",
      login: "active",
      user: req.session.user,  
      message: err.message,
    });
    res.status(400).json({ message: err.message });
  }

  res.render("index", {
    title: "Graphite",
    home: "active",
    user: req.session.user,  
    message: "Password reset success!",
  });
});

// get handler for /account
// the account page currently doesn't do anything
router.get("/account", requiresLogin, (req, res) => {
  res.render("account", {
    title: "Graphite",
    account: "active",
    user: req.session.user,
  });
});

/////////////////////////////ADMIN PAGES/////////////////////////////////
//the admin pages handle manipulation of users

// get handler for /admin
router.get("/admin", requiresAdmin, async (req, res) => {
  // gets all of the users, sorted in in descending order by user_ID
  const users = await User.find().sort({ user_ID: -1 });
  res.render("admin", {
    title: "Graphite",
    admin: "active",
    user: req.session.user,
    data: users,
  });
});

// post handler for /admin
router.post("/admin", requiresAdmin, async (req, res) => {
  // in the admin view there are two separate forms, one for deleting and one for editing
  // the corresponding action is taken depending on which ID is submitted
  if(req.body.ID_1) {
    User.findOneAndDelete({ user_ID: parseInt(req.body.ID_1) }, function (err, result) {
      // TODO: handle errors properly
      if (err) {
        res.send(err);
      }
    });
  } else if(req.body.ID_2) {
    // edit the user data
    User.findOneAndUpdate({user_ID: parseInt(req.body.ID_2)}, {email: req.body.email, access: parseInt(req.body.access)}, function (err, result) {
      // TODO: handle errors properly
      if (err) {
        res.send(err);
      }
    });
  }

  // redirects
  const users = await User.find().sort({ user_ID: -1 });
  res.render("admin", {
    title: "Graphite",
    admin: "active",
    user: req.session.user,
    // message goes in the alert to confirm the action went through
    message: "updated",
    data: users,
  });

});

///////////////////////////STORY PAGES////////////////////////////////////
//the story pages handle creation and manipulation of stories (the data files)

// get handler for /stories
router.get("/stories", requiresLogin, async (req, res) => {
  // if the user's access level is admin or higher, display all stories
  // otherwise, only display their own
  // sort the stories in descending order by dateEdited
  let stories;
  if(req.session.user.access > 0) {
    stories = await Story.find().sort({ dateEdited: -1 });
  } else {
    stories = await Story.find({
      user_ID: req.session.user.user_ID,
    }).sort({ dateEdited: -1 });
  }

  res.render("stories", {
    title: "Graphite",
    stories: "active",
    user: req.session.user,
    data: stories,
  });
});

// post handler for /stories
router.post("/stories", requiresLogin, async (req, res) => {
  if (req.body.function == "edit") {
    // fetch the story from the database
    let story = await Story.find({ story_ID: req.body.ID });
    // format the raw data back into a layout that can be parsed into the form
    // the reformatting has to be done on the back-end because modules don't work on the front-end
    let storyData = helper.reverseJson(JSON.parse(story[0].story));

    res.render("new_story", {
      title: "Graphite",
      stories: "active",
      user: req.session.user,
      data: storyData,
      story_ID: story[0].story_ID,
    });
  } else if (req.body.function == "delete") {
    Story.findOneAndDelete({ story_ID: req.body.ID }, function (err, result) {
      // TODO: handle errors properly
      if (err) {
        res.send(err);
      }
    });

    // refresh the data
    let stories;
    if(req.session.user.access > 0) {
      stories = await Story.find().sort({ dateEdited: -1 });
    } else {
      stories = await Story.find({
        user_ID: req.session.user.user_ID,
      }).sort({ dateEdited: -1 });
    }

    res.render("stories", {
      title: "Graphite",
      stories: "active",
      user: req.session.user,
      message: "deleted",
      data: stories,
    });
  }
});

// get handler for /new_story
router.get("/new_story", requiresLogin, (req, res) => {
  res.render("new_story", {
    title: "Graphite",
    stories: "active",
    user: req.session.user,
  });
});

// post handler for /new_story
router.post("/new_story", requiresLogin, async (req, res) => {
  // format the story form data so it's easier to use when creating the graphs
  let json = helper.formatJson(req.body);
  // if the story id is already set, this means we're updating a story
  if (req.body.story_ID >= 0) {
    Story.findOneAndUpdate(
      { story_ID: req.body.story_ID },
      { story: JSON.stringify(json), dateEdited: new Date() },
      function (err, result) {
        // TODO: handle errors properly
        if (err) {
          res.send(err);
        }
      }
    );
  } else {
    // otherwise, create a new story
    const story = new Story({
      user_ID: req.session.user.user_ID,
      story: JSON.stringify(json),
    });

    //attempt to save the story
    try {
      const newStory = await story.save();
    } catch (err) {
      // TODO: handle errors properly
      res.render("new_story", {
        title: "Graphite",
        stories: "active",
        message: err.message,
      });
      res.status(400).json({ message: err.message });
    }
  }

  // redirect
  let stories;
  if(req.session.user.access > 0) {
    stories = await Story.find().sort({ dateEdited: -1 });
  } else {
    stories = await Story.find({
      user_ID: req.session.user.user_ID,
    }).sort({ dateEdited: -1 });
  }

  res.render("stories", {
    title: "Graphite",
    stories: "active",
    message: req.body.story_ID >= 0 ? "updated" : "created",
    user: req.session.user,
    data: stories,
  });
});

///////////////////////////GRAPH PAGES////////////////////////////////////
//the graph pages handle creation and manipulation of different types of graphs

// get handler for /graphs
router.get("/graphs", requiresLogin, async (req, res) => {
  // if the user's access level is admin or higher, display all graphs
  // otherwise, only display their own
  let graphs;
  if(req.session.user.access > 0) {
    graphs = await Graph.find();
  } else {
    graphs = await Graph.find({
      user_ID: req.session.user.user_ID,
    });
  }

  // get all the graph templates (the different types of graph)
  const templates = await Template.find();
  
  // get all the stories
  let stories;
  if(req.session.user.access > 0) {
    stories = await Story.find().sort({ dateEdited: -1 });
  } else {
    stories = await Story.find({
      user_ID: req.session.user.user_ID,
    }).sort({ dateEdited: -1 });
  }

  res.render("graphs", {
    title: "Graphite",
    graphs: "active",
    user: req.session.user,
    data: graphs,
    templateData: templates,
    storyData: stories,
  });
});

// post handler for /graphs
router.post("/graphs", requiresLogin, async (req, res) => {
  // edit the graph
  if (req.body.function == "edit") {
    // find all the appropriate data
    const graph = await Graph.find({ graph_ID: req.body.ID });

    const templates = await Template.find({
      template_ID: graph[0].template_ID,
    });

    const stories = await Story.find({ story_ID: graph[0].story_ID });

    // load into new_graph
    res.render("new_graph", {
      title: "Graphite",
      graphs: "active",
      data: stories,
      templateData: templates,
      graphData: graph,
      user: req.session.user,
    });
  } else if (req.body.function == "delete") {
    Graph.findOneAndDelete({ graph_ID: req.body.ID }, function (err, result) {
      // TODO: handle errors properly
      if (err) {
        res.send(err);
      }
    });

    // find all the appropriate data
    let graphs;
    if(req.session.user.access > 0) {
      graphs = await Graph.find();
    } else {
      graphs = await Graph.find({
        user_ID: req.session.user.user_ID,
      });
    }
    const templates = await Template.find();

    let stories;
    if(req.session.user.access > 0) {
      stories = await Story.find().sort({ dateEdited: -1 });
    } else {
      stories = await Story.find({
        user_ID: req.session.user.user_ID,
      }).sort({ dateEdited: -1 });
    }

    // redirect
    res.render("graphs", {
      title: "Graphite",
      graphs: "active",
      user: req.session.user,
      data: graphs,
      templateData: templates,
      storyData: stories,
      message: "deleted",
    });
  } else if(req.body.template_ID) {
    // new story
    const template = await Template.find({ template_ID: req.body.template_ID });

    const story = await Story.find({ story_ID: req.body.storyList });

    res.render("new_graph", {
      title: "Graphite",
      graphs: "active",
      user: req.session.user,
      data: story,
      template_ID: req.body.template_ID,
      templateData: template,
    });
  }
});

// get handler for /new_graph
router.get("/new_graph", requiresLogin, async (req, res) => {
  res.render("new_graph", {
    title: "Graphite",
    graphs: "active",
    user: req.session.user,
  });
});

// post handler for /new_graph
router.post("/new_graph", requiresLogin, async (req, res) => {
  // format the options for the graph
  let options = {
    colour: req.body.colourSelect,
  };

  // if the graph id is >= 0 we're editing a graph
  if (req.body.graph_ID >= 0) {
    Graph.findOneAndUpdate(
      { graph_ID: req.body.graph_ID },
      { options: JSON.stringify(options) },
      function (err, result) {
        // TODO: handle errors properly
        if (err) {
          res.send(err);
        }
      }
    );
  } else {
    // otherwise create a new graph
    const graph = new Graph({
      user_ID: req.session.user.user_ID,
      story_ID: req.body.story_ID,
      template_ID: req.body.template_ID,
      name: req.body.name,
      options: JSON.stringify(options),
    });

    try {
      const newGraph = await graph.save();
    } catch (err) {
      // TODO: handle errors properly
      res.render("new_graph", {
        title: "Graphite",
        stories: "active",
        message: err.message,
      });
      res.status(400).json({ message: err.message });
    }
  }

  // fetch all the appropriate data
  let graphs;
  if(req.session.user.access > 0) {
    graphs = await Graph.find();
  } else {
    graphs = await Graph.find({
      user_ID: req.session.user.user_ID,
    });
  }

  const templates = await Template.find();
  
  const stories = await Story.find({
    user_ID: req.session.user.user_ID,
  }).sort({ dateEdited: -1 });
  
  // redirect
  res.render("graphs", {
    title: "Graphite",
    graphs: "active",
    user: req.session.user,
    data: graphs,
    templateData: templates,
    storyData: stories,
    message: req.body.graph_ID >= 0 ? "updated" : "created",
  });
});

//////////////////////////////VALIDATION FUNCTIONS/////////////////////////////////////

// function to make sure a user is logged in
async function requiresLogin(req, res, next) {
  // TODO: handle errors properly
  if (req.session.user) {
    return next();
  } else {
    var err = new Error("You must be logged in to view this page.");
    res.render("error", {
      title: "Graphite",
      message: "You must be logged in to view this page.",
    });
    return next(err);
  }
}

// function to make sure an admin is logged in
async function requiresAdmin(req, res, next) {
  // TODO: handle errors properly
  if (req.session.user) {
    if(req.session.user.access > 0) {
      return next();
    } else {
      var err = new Error("You must be an admin to view this page.");
      res.render("error", {
        title: "Graphite",
        message: "You must be an admin to view this page.",
      });
      return next(err);
    }
  } else {
    var err = new Error("You must be logged in to view this page.");
    res.render("error", {
      title: "Graphite",
      message: "You must be logged in to view this page.",
    });
    return next(err);
  }
}

// function to authenticate a user
async function authenticateUser(req, res, next) {
  // TODO: handle errors properly
  // no email supplied
  if (!req.body.email) {
    res.render("login", {
      title: "Graphite",
      login: "active",
      message: "Please enter an email.",
    });
    return res.status(404).json({ message: "Please enter an email." });
  }

  //no password supplied
  if (!req.body.password) {
    res.render("login", {
      title: "Graphite",
      login: "active",
      message: "Please enter a password.",
    });
    return res.status(404).json({ message: "Please enter a password." });
  }

  // search for users
  user = await User.findOne({ email: req.body.email });

  // no user found
  if (user == null) {
    res.render("login", {
      title: "Graphite",
      login: "active",
      message: "Unknown user.",
    });
    return res.status(404).json({ message: "Unknown user." });
  }

  // check the password matches
  user.comparePassword(req.body.password, (err, isMatch) => {
    if (err) throw err;
    if (!isMatch) {
      return res.render("login", {
        title: "Graphite",
        login: "active",
        message: "Wrong password.",
      });
    }
    req.session.user = user;
    res.redirect("/");
  });

  next();
}

module.exports = router;

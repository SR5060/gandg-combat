

/**
 * A single ToDo in out list of Todos.
 * @typedef {Object} ToDo
 * @property {string} id - aunique ID to identify this todo
 * @property {string} label - The text of the todo.
 * @property {boolean} isDone - Marks whether the todo is done.
 * @property {string} userId - The user who owns this todo.
 */

class ToDoList {
    static ID = 'todo-list';
    static FLAGS = {
        TODOs: 'todos'
    }
    static TEMPLATES ={
        TODOLIST: `modules/${this.ID}/templates/todo-list.hbs`
    }

    static initialize() {
        this.toDoListConfig = new ToDoListConfig();
    }

  /**
   * A small helper function which leverages developer mode flags to gate debug logs.
   * 
   * @param {boolean} force - forces the log even if the debug flag is not on
   * @param  {...any} args - what to log
   */

   static log(force, ...args) {
    const shouldLog = force || Game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

    if (shouldLog) {
        console.log(this.ID, '|', ...args);
    }
  }   
}

class ToDoListData {
    static getToDosForUser(userId) {
        return game.users.get(userId)?.getFlag(ToDoList.ID, ToDoList.FLAGS.TODOs);
    }

    static createToDo(userId, toDoData) {
        //generate a random id for this new ToDo and populate the userId
        const newToDo = {
            isDone: false,
            ...toDoData,
            id: foundry.utils.randomID(16),
            userId,
        }
        // construct the update to insert the new ToDo
        const newToDos = {
            [newToDo.id]: newToDo
        }
        return game.users.get(userId)?.setFlag(ToDoList.ID, ToDoList.FLAGS.TODOs,newToDos);
    }

    static get allToDos() {
        const allToDos = game.users.reduce((accumulator, user) => {
            const userTodos = this.getToDosForUser(user.id);

            return {
                ...accumulator,
                ...userTodos
            }
        }, {});

        return allToDos;
    }

    static updateToDo(toDoId, updateData) {
        const relevantToDo = this.allToDos[toDoId];

        const update = {
            [toDoId]: updateData
        }

        return game.users.get(relevantToDo.userId)?.setFlag(ToDoList.ID, ToDoList.FLAGS.TODOs, update);
    }
    
    static deleteToDo(toDoId) {
        const relevantToDo = this.allToDos[toDoId];

        const keyDeletion = {
            ['-=${toDoId}']: null
        }

        return game.users.get(relevantToDo.userId)?.setFlag(ToDoList.ID, ToDoList.FLAGS.TODOs, keyDeletion);
    }

    static updateUserToDos(userId, updateData) {
        return game.users.get(userId)?.setFlag(ToDoList.ID, ToDoList.FLAGS.TODOs, updateData);    
    }
}

class ToDoListConfig extends FormApplication {
    static get defaultOptions() {
      const defaults = super.defaultOptions;
  
      const overrides = {
        closeOnSubmit: false,
        height: 'auto',
        id: 'todo-list',
        submitOnChange: true,
        template: ToDoList.TEMPLATES.TODOLIST,
        title: 'To Do List',
        userId: game.userId,
      };
  
      const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
  
      return mergedOptions;
    }
  
    async _handleButtonClick(event) {
      const clickedElement = $(event.currentTarget);
      const action = clickedElement.data().action;
      const toDoId = clickedElement.parents('[data-todo-id]')?.data()?.todoId;
  
      switch (action) {
        case 'create': {
          await ToDoListData.createToDo(this.options.userId);
          this.render();
          break;
        }
  
        case 'delete': {
          await ToDoListData.deleteToDo(toDoId);
          this.render();
          break;
        }
  
        default:
          ToDoList.log(false, 'Invalid action detected', action);
      }
    }
  
    activateListeners(html) {
      super.activateListeners(html);
  
      html.on('click', "[data-action]", this._handleButtonClick.bind(this));
    }
  
    getData(options) {
      return {
        todos: ToDoListData.getToDosForUser(options.userId)
      }
    }
  
    async _updateObject(event, formData) {
        ToDoList.log(false, 'saving', {
            formData
          });
      const expandedData = foundry.utils.expandObject(formData);
  
      await ToDoListData.updateUserToDos(this.options.userId, expandedData);
    }
  }

/**
 * Register our module's debug flag with developer mode's custom hook
 */
 Hooks.once('devModeReady', ({registerPackageDebugFlag}) => {
    registerPackageDebugFlag(ToDoList.ID);
});

Hooks.once('init', () => {
    ToDoList.initialize();
  });

Hooks.on('renderPlayerList', (playerList, html) => {
    const loggedInUserListItem = html.find(`[data-user-id="${game.userId}"]`);

    const tooltip = game.i18n.localize('TODO-LIST.button-title');

    loggedInUserListItem.append(
        `<button type='button' class='todo-list-icon-button flex0' title='${tooltip}'>
            <i class='fas fa-tasks'></i>
        </button>`
    );

    html.on('click', '.todo-list-icon-button', (event) => {
        const userId = $(event.currentTarget).parents('[data-user-id]')?.data()?.userId;

        ToDoList.toDoListConfig.render(true, { userId });
    });
});
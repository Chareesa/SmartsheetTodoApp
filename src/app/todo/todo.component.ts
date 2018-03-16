import { Component} from '@angular/core';
import { Todo } from '../models/todo.model';
import { TodoService } from '../services/todo.service';

@Component({
    selector: 'app-todo',
    templateUrl: 'todo.component.html',
    styleUrls: ['todo.component.css']
})

export class TodoComponent {
    newTodoText = '';
    newCatText = '';
    public todos: Array<Todo>;
    public categories: Array<Todo>;
    public uncategorizedTodos: Array<Todo>;
    selectedCategory;


    constructor(private todoService: TodoService) {
        todoService.getTodos()
            .subscribe(todos => { if (todos) {this.todos = todos.sort((a, b) => a.ordinal - b.ordinal); }});
        this.categories = todoService.getCategories();
        this.uncategorizedTodos = todoService.getUncategorized();
    }

    stopEditing(todo: Todo, editedTitle: string) {
        todo.name = todo.name;
        todo.editing = false;
    }

    cancelEditingTodo(todo: Todo) {
        todo.editing = false;
    }

    updateEditingTodo(editedTodo: Todo, editedTitle: string) {
        editedTitle = editedTitle.trim();
        editedTodo.editing = false;

        if (editedTitle.length === 0) {
            return this.todoService.deleteTodo(editedTodo);
        }
        editedTodo.name = editedTitle;
        this.todoService.updateTodo(this.todos.find(todo => todo.rowId === editedTodo.rowId));
    }

    editTodo(todo: Todo) {
        todo.editing = true;
    }

    toggleCompletion(todo: Todo) {
        todo.done = !todo.done;
        this.todoService.updateTodo(todo);
    }

    remove(todo: Todo) {
        this.todoService.deleteTodo(todo);
    }

    addCategory() {
        if (this.newCatText.trim().length) {
            this.todoService.addTodo(this.newCatText);
            this.newCatText = '';
        }
    }

    addTodo() {
        if (this.newTodoText.trim().length) {
            this.todoService.addTodo(this.newTodoText);
            this.newTodoText = '';
        }
    }

    removeCompleted() {
        const todosToDelete = new Array<number>();

        this.todos.filter(todo => {
            if (todo.done) {
                return true;
            }}).map(todo => todosToDelete.push(todo.rowId));

        this.todoService.deleteTodos(todosToDelete);
    }

    get todosForCat() {
        if (this.selectedCategory === 0) {
            return this.todoService.getTodoByCategory(this.selectedCategory);
        } else {
            return this.todoService.getTodoByCategory(this.selectedCategory.categoryId);
        }
    }

    countTodosByCat(id: number) {
        return this.todoService.getTodoByCategory(id).length;
    }

    onSelect(category: Todo): void {
        if(category) {
            this.selectedCategory = category;
        } else {
            this.selectedCategory = 0;
        }
    }
}
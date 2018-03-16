import {Injectable} from '@angular/core';
import {Todo} from '../models/todo.model';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/do';
import 'rxjs/add/observable/throw';
import {Http, Response} from '@angular/http';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import {SmartsheetConfig} from '../../smartsheet.config';

const SHEET_URL = `${SmartsheetConfig.smartsheetUrl}/sheets/${SmartsheetConfig.sheetId}`;

@Injectable()
export class TodoService {
    private todos: BehaviorSubject<Array<Todo>> = null;
    private allTodos: Todo[] = [];
    private categories: Todo[] = [];
    private uncategorizedTodos: Todo[] = [];
    private categoryNum = 1;

    constructor(private http: Http) {
        var self = this;
        this.todos = new BehaviorSubject(null);
        this.http.get(`${SHEET_URL}`) /* -> result */
        /* result -> */ .map(this.extractData) /* -> Json */
        /* Json -> */   .map(this.fromJson) /* -> Array<Todo> */
                        .do((data) => {
                           this.createCategories(data);
                        })
                        .catch((res: Response) => this.handleError(res))
                        .subscribe(todos => this.todos.next(todos));
    }

    private createCategories(todos) {
        let lastParentNode;
        let finalTodo = todos[todos.length-1];
        finalTodo.categoryId = 0;
        
        todos.forEach(todo => {
          if (!todo.parentId) {
              if (lastParentNode && !lastParentNode.isRowCategory) {
                  lastParentNode.categoryId = 0;
                  this.uncategorizedTodos.push(lastParentNode);
                  lastParentNode = '';
              }
              lastParentNode = todo;
          } else if (lastParentNode) {
              if (todo.parentId === lastParentNode.rowId) {
                  this.allTodos.push(todo);
                  if (!lastParentNode.isRowCategory) {
                      lastParentNode.isRowCategory = true;
                      lastParentNode.categoryId = this.categoryNum;
                      this.categories.push(lastParentNode);
                      this.categoryNum++;
                  }
                  todo.categoryId = lastParentNode.categoryId;
              } 
          }
        })
        if (!finalTodo.parentId) {
          this.uncategorizedTodos.push(finalTodo);
        }
    }
    getUncategorized() {
      return this.uncategorizedTodos;
    }
    getCategories() {
      return this.categories;
    }
    getTodos(): Observable<Array<Todo>> {
        return this.todos;
    }

    deleteTodo(todoToDelete: Todo): Observable<Array<Todo>> {
        this.deleteTodos([todoToDelete.rowId]);
        return this.todos;
    }

    deleteTodos(todoIds: Array<number>) {
        const todosToDelete = todoIds.join();

        this.http.delete(`${SHEET_URL}/rows?ids=${todosToDelete}`)
            .map(this.extractData)
            .catch((res: Response) => this.handleError(res))
            .subscribe(deletedTodos => {
                let remainingTodos;
                this.todos.subscribe(
                    todos => remainingTodos = todos.filter(todo => !deletedTodos.includes(todo.rowId)));
                if (remainingTodos) {
                    this.todos.next(remainingTodos);
                }
            });
    }

    //can send with parentId, but isn't recorded in Smartsheet and doesn't come back with one.
    addTodo(newTodoTitle: string) {
        const newTodoJson = this.toNewTodoJson(newTodoTitle);
        this.http.post(`${SHEET_URL}/rows`, JSON.stringify(newTodoJson))
            .map(this.extractData)
            .map(this.fromJson)
            .catch((res: Response) => this.handleError(res))
            .subscribe(newTodo => {
                let todos;
                this.todos.subscribe(todosSub => todos = todosSub);
                if (todos) {
                    todos.push(newTodo[0]);
                    this.todos.next(todos);
                }
            });
    }

    updateTodo(todoToUpdate: Todo): Observable<Array<Todo>> {
        this.http.put(`${SHEET_URL}/rows`, this.toUpdateTodoJson(todoToUpdate))
            .map(this.extractData)
            .map(this.fromJson)
            .catch((res: Response) => this.handleError(res))
            .subscribe(newTodo => {
                let todos;
                this.todos.subscribe(todosSub => {
                    todos = todosSub.filter(todo => todo.rowId !== newTodo[0].rowId);
                });
                if (todos) {
                    todos.push(newTodo[0]);
                    this.todos.next(todos);
                }
            });
        return this.todos;
    }

    private extractData(res: Response) {
        const body = res.json();
        return (body) ? body.result || body : {};
    }

    private fromJson(json: any): Array<Todo> {
        console.log('JSON HERE', json);
        const todos = new Array<Todo>();
        let rows = null;

        if (json.rows) {
            rows = json.rows;
        } else {
            if (json instanceof Array) {
                rows = json;
            } else {
                rows = [json];
            }
        }

        rows.forEach(row => {
            const todo = new Todo(row.id, row.rowNumber, row.dueDate);
            if (row.parentId) {
                todo.parentId = row.parentId;
            }
            row.cells.forEach(cell => {
                switch (cell.columnId) {
                    case SmartsheetConfig.taskNameColumnId:
                        todo.name = cell.value;
                        break;
                    case SmartsheetConfig.dueDateColumnId:
                        if (cell.value) {
                          todo.dueDate = cell.value;
                        } else {
                            todo.dueDate = '';
                        }
                        break;
                    case SmartsheetConfig.doneColumnId:
                        todo.done = cell.value ? cell.value : false;
                }
            });

            if (todo.name) {
                todos.push(todo);
            }
        });
        return todos;
    }

    private toNewTodoJson(newTodoTitle: string) {
        return {
            toBottom: true,
            cells: [
                {columnId: SmartsheetConfig.taskNameColumnId, value: newTodoTitle}
            ]
        };
    }

    private toUpdateTodoJson(todo: Todo) {
        return {
            id: todo.rowId,
            cells: [
                {
                    columnId: SmartsheetConfig.taskNameColumnId,
                    value: todo.name
                },
                {
                    columnId: SmartsheetConfig.doneColumnId,
                    value: todo.done
                },
                {
                    columnId: SmartsheetConfig.dueDateColumnId,
                    value: todo.dueDate
                }
            ]
        };
    }

    private handleError(error: Response | any) {
        // In a real world app, you might use a remote logging infrastructure
        let errMsg: string;
        if (error instanceof Response) {
            const body = error.json() || '';
            const err = body.error || JSON.stringify(body);
            errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
        } else {
            errMsg = error.message ? error.message : error.toString();
        }
        console.error(errMsg);
        return Observable.throw(errMsg);
    }

    getTodoByCategory(id: number): Todo[] {
      if (id === 0) {
        console.log('uncat', this.uncategorizedTodos);
        return this.uncategorizedTodos
        .filter(todo => todo.categoryId === id);
      } else {
          return this.allTodos
            .filter(todo => todo.categoryId === id);
      }
    }
}

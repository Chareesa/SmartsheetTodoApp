export class Todo {
  id: number;
  title = '';
  complete = false;
  categoryId: number;
  editing: Boolean;
  parentId: number;

  constructor(public rowId: number,
              public isRowCategory: boolean,
              public ordinal?: number,
              public name?: string,
              public done?: boolean,
              public dueDate?: string) {
    this.editing = false;
    this.isRowCategory = false;
    this.dueDate = '';
  }
}


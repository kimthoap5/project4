import * as AWS from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { createLogger } from '../utils/logger'
import { TodoItem } from '../models/TodoItem'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import { AttachmentUtils } from '../helpers/attachmentUtils'

const AWSXRay = require('aws-xray-sdk')
const XAWS = AWSXRay.captureAWS(AWS)

const logger = createLogger('TodosAccess')
const attachment = new AttachmentUtils()

// TODO: Implement the dataLayer logic
export class TodosAccess {
  constructor(
    private readonly docClient: DocumentClient = new XAWS.DynamoDB.DocumentClient(),
    private readonly todosTable = process.env.TODOS_TABLE,
    private readonly todosIndex = process.env.INDEX_NAME
  ) { }

  async getAllTodos(): Promise<TodoItem[]> {

    const result = await this.docClient.query({
      TableName: this.todosTable
    }).promise()

    const items = result.Items
    return items as TodoItem[]
  }

  async getTodos(userId: string): Promise<TodoItem[]> {
    logger.info('Checking getTodos function')

    const result = await this.docClient
      .query({
        TableName: this.todosTable,
        IndexName: this.todosIndex,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      })
      .promise()

    const items = result.Items
    return items as TodoItem[]
  }
  // Create todo
  async createTodoItem(todoItem: TodoItem): Promise<TodoItem> {
    logger.info('Checking createTodoItem function')
    const result = await this.docClient
      .put({
        TableName: this.todosTable,
        Item: todoItem
      })
      .promise()
    logger.info('Item created', result)
    return todoItem as TodoItem
  }
  // Delete todo
  async deleteTodo(userId: string, fieldId: string): Promise<boolean> {
    await this.docClient.delete({
      TableName: this.todosTable,
      Key: {
        "userId": userId,
        "todoId": fieldId
      },
    }).promise()
    return true
  }
  // Update todo
  async updateTodo(fieldId: string, userId: string, updateTodoRequest: UpdateTodoRequest) {
    let expressionAttibutes = {
      ":done": updateTodoRequest.done,
      ":name": updateTodoRequest.name,
      ":dueDate": updateTodoRequest.dueDate
    }
    let updateExpression = "set done = :done, dueDate= :dueDate, #n= :name"

    await this.docClient.update({
      TableName: this.todosTable,
      Key: {
        "userId": userId,
        "todoId": fieldId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttibutes,
      ExpressionAttributeNames: {
        "#n": "name"
      }
    }).promise()
  }
  // Upload Image
  async updateTodoAttachmentUrl(userId: string, fieldId: string) {
    logger.info('Checking updateTodoAttachmentUrl')
    const s3AttachmentUrl = attachment.getAttachmentUrl(fieldId)
    const dbTodoTable = process.env.TODOS_TABLE
    const params = {
      TableName: dbTodoTable,
      Key: {
        userId,
        fieldId
      },
      UpdateExpression: 'set attachmentUrl = :attachmentUrl',
      ExpressionAttributeValues: {
        ':attachmentUrl': s3AttachmentUrl
      },
      ReturnValues: 'UPDATED_NEW'
    }
    await this.docClient.update(params).promise()
  } 
}
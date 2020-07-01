import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer not exists');
    }

    const productIds = products.map(product => ({ id: product.id }));

    const productsReturn = await this.productsRepository.findAllById(
      productIds,
    );

    if (productsReturn.length !== products.length) {
      throw new AppError('Product not exists');
    }

    const productsFiltered = productsReturn.map((item, index) => {
      return {
        product_id: products[index].id,
        quantity: products[index].quantity,
        price: item.price,
      };
    });

    const updatedProducts = productsReturn.map((item, index) => {
      if (productsFiltered[index].quantity > item.quantity) {
        throw new AppError('Stock not available for some products');
      }

      return Object.assign(item, {
        quantity: item.quantity - productsFiltered[index].quantity,
      });
    });

    await this.productsRepository.updateQuantity(updatedProducts);

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: productsFiltered,
    });

    delete order.customer_id;

    return order;
  }
}

export default CreateOrderService;

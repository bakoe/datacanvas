FROM varg/blender-docker:latest

# Basics
RUN DEBIAN_FRONTEND=noninteractive apt install -y python3 python3-dev python3-pip

# Python3
WORKDIR /opt/blender-render-service

ADD fastapi-server /opt/blender-render-service
ENV LANG=en_US.UTF-8
RUN python3 -m pip install pipenv
RUN pipenv install

CMD ["pipenv", "run", "uvicorn", "--bind", "0.0.0.0", "run_server:app", "-k", "uvicorn.workers.UvicornWorker"]
